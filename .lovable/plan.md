## Correção 1 — Listagem e bloqueio entre Corte e Romaneio

**`src/components/cop/CorteTab.tsx`**
- Renomear o filtro padrão `__corte__` para `__ativos__` com critério `status !== "Finalizado" && pagamento_status !== "pago"`.
- Manter opção **Todos** e os filtros por status individual.
- Manter o bloqueio existente do editor de corte quando `status ∈ STATUS_POS_CORTE`.

**`src/components/cop/RomaneioTab.tsx`**
- Mesma mudança de filtro padrão: **Ativos** (`status !== "Finalizado" && pagamento_status !== "pago"`), com **Todos** e filtros por status.
- Adicionar `const bloqueadoRomaneio = STATUS_CORTE.includes(selected.status)`.
- Quando `bloqueadoRomaneio`:
  - Todos os inputs do romaneio (oficina, datas de envio/previsão, observações etc.) ficam `disabled`/read-only.
  - Botões **Enviar para a oficina**, **Particionar**, **Registrar entrega** e demais ações ficam `disabled`.
  - Mostrar aviso curto no topo do editor no estilo do já usado na CorteTab: *"Este COP ainda está no Corte (status X). O romaneio só pode ser preenchido após 'Mandar pro Romaneio'."*
- O botão **Voltar para Corte** (admin) continua disponível normalmente.

## Correção 2 — Frete sai do Romaneio e vai pro Pagamento

**`src/components/cop/RomaneioTab.tsx`**
- Remover o input **Nº de fretes** (`num_fretes`) e qualquer escrita dele no `update`.
- Remover o sufixo `· frete R$ X` no seletor de oficina (mostrar só o nome).
- Em `handleParticionar`: manter herança do `num_fretes` do pai (apenas como ponto de partida).

**`src/components/cop/PagamentoOficinasTab.tsx`**
- Adicionar input numérico **Nº de fretes** (min 1), pré-preenchido com `cop.num_fretes`.
- Editável apenas se `pagamento_status === "nao_pago"`; senão somente leitura.
- Recalcular total na hora usando o valor editado (substituir `cop.num_fretes` por `numFretesEdit` no cálculo `valor_frete × num_fretes`).
- Persistir `num_fretes` em **Salvar conferência** e também no **Liberar pagamento** (para o snapshot ficar correto).

## Correção 3 — Numeração da partição (0001B nunca vira 0002B)

### 3a) Migração nova `supabase/migrations/<timestamp>_cop_particao_numero.sql`

Confirmado: a constraint atual tem o nome default **`cops_numero_key`** (linha 31 da migration original `...a9031a5c...`). SQL:

```sql
-- 1) Remover unicidade simples de numero
ALTER TABLE public.cops DROP CONSTRAINT IF EXISTS cops_numero_key;

-- 2) Unicidade composta (numero, letra) tratando NULL como ''
CREATE UNIQUE INDEX IF NOT EXISTS cops_numero_letra_uidx
  ON public.cops (numero, (COALESCE(letra, '')));

-- 3) Reatribuir numero dos filhos de partição já existentes para o do pai-origem
UPDATE public.cops f
SET numero = p.numero
FROM public.cops p
WHERE f.cop_romaneio_pai_id IS NOT NULL
  AND p.id = f.cop_romaneio_pai_id
  AND f.numero <> p.numero;

-- 4) Reposicionar o sequence
SELECT setval('public.cops_numero_seq', (SELECT COALESCE(MAX(numero), 0) FROM public.cops));
```

Sem `DROP TABLE`/`TRUNCATE`/`DELETE`. Não toca tabelas do PCP. A **Divisão de Corte** (filhos com `cop_pai_id` e `letra` nula) continua consumindo número novo do sequence — comportamento inalterado.

### 3b) App — filho de partição nasce com número do pai

Em `handleParticionar` (`RomaneioTab.tsx`), no `insert` do filho: passar `numero: numeroBaseCop(selected, cops)` explicitamente, em vez do default do sequence.

### 3c) Exibição consistente do rótulo

- `PagamentoOficinasTab.tsx`: cabeçalho do COP selecionado e a coluna **COP** da tabela usam `rotuloRomaneio(c, cops)` (importar de `@/lib/cop`).
- `RomaneioTab.tsx`: nome do PDF passa a usar `formatCopNumero(numeroBaseCop(selected, cops))` no lugar de `formatCopNumero(selected.numero)`.

## Escopo / Garantias

- Nenhuma alteração em tabelas do PCP (`pedidos`, `profiles`, `user_roles`, `app_color_settings`, `app_lists`, `feriados`).
- Migration toca apenas `cops` (constraint + UPDATE dos filhos de partição) e `cops_numero_seq` (setval).
- Se a constraint `cops_numero_key` não existir (nome diferente), o `DROP CONSTRAINT IF EXISTS` é no-op — neste caso eu paro e pergunto antes de prosseguir.
