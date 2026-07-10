
# Plano — Urgência no Romaneio + Uniformização de Botões

Executo exatamente o escopo do prompt, respeitando o PLAN-GATE e as regras invioláveis de banco (somente `ADD COLUMN IF NOT EXISTS`, sem `DROP`/`ALTER TYPE`/mudança de RLS).

## Parte A — Pedido de Urgência (registro auditável)

### A1. Migração (aditiva)
Novo arquivo `supabase/migrations/<timestamp>_cops_urgencias.sql`:
```sql
ALTER TABLE public.cops
  ADD COLUMN IF NOT EXISTS urgencias jsonb NOT NULL DEFAULT '[]'::jsonb;
```
Nada além disso. Sem índices, triggers, policies ou grants novos.

### A2. Tipos em `src/lib/cop.ts` (só adições)
- `CopUrgenciaLinha = { modelo; cor }`
- `CopUrgencia = { em; por; observacao; linhas }`
- Campo `urgencias: CopUrgencia[]` no tipo `Cop`
- Helper `linhaUrgente(urgencias, modelo, cor): boolean`

### A3. Novo `src/components/cop/PedirUrgenciaDialog.tsx`
Segue padrão visual do `RegistrarPerdaDialog`:
- Lista linhas modelo+cor do romaneio (agrupadas com a mesma função já usada na grade); checkbox por linha; linhas 100% recebidas ficam desabilitadas com nota "completa".
- Textarea `uppercase` de observação, obrigatória.
- Botão confirmar desabilitado se observação vazia ou nenhuma linha marcada.
- Ao confirmar: `append` no array `urgencias` (imutável, nunca sobrescreve) e update apenas de `urgencias` (+ `updated_at`/`updated_by` seguindo o padrão do arquivo). Invalida `["cops"]`.

### A4. Indicadores em `RomaneioTab.tsx`
- Ícone `Flame` vermelho `h-3.5 w-3.5 text-red-600` ao lado do modelo nas linhas urgentes da grade "Peças do Romaneio (do Corte)"; esmaece (`text-muted-foreground`) quando aquela linha já está 100% recebida.
- Badge `URGÊNCIA` (ou `URGÊNCIA ×N`) `bg-red-100 text-red-800 border border-red-300` no cabeçalho do editor perto do status.
- Mesmo badge compacto na coluna Romaneio da listagem + `Flame` vermelho nas linhas modelo+cor urgentes. Ordenação/filtros da listagem **não** mudam.
- Feed de "Histórico" existente ganha os registros de urgência (badge vermelho `urgência`), ordenado por data, com Dialog de detalhe somente leitura listando linhas e observação completa.

## Parte B — Uniformização dos botões do Romaneio

### B1. `src/hooks/use-cop-color-settings.ts`
- Adiciona chaves `corrigir_corte`, `registrar_perda`, `pedir_urgencia` em `CopBotaoKey` e `DEFAULT_COP_BOTAO_COLORS` com os defaults do prompt.
- Corrige o loop de `mergeSettings` para iterar `Object.keys(DEFAULT_COP_BOTAO_COLORS)` em vez da lista hardcoded (bug fix aditivo; cores já salvas continuam preservadas).

### B2. Rodapé do editor do romaneio em `RomaneioTab.tsx`
Todos os botões em uma linha só: `flex flex-wrap items-center gap-2`, sem divisão esquerda/direita, na ordem:
1. `romaneio-XXXX.pdf` (condicional atual)
2. `Particionar` (condicional atual)
3. `Corrigir corte` (`canManageCop`, condicional atual)
4. `Registrar perda` (`canManageCop`, condicional atual)
5. `Pedir Urgência` — **novo**, ícone `Flame`, visível quando `canManageCop` e status ∈ {`Na Oficina (Costura)`, `Romaneio Parcial`}
6. `Salvar`
7. `Enviar para Oficina`
8. `Entrega de Romaneio`

Padrão uniforme: `h-10 w-[185px] justify-center truncate`, ícone `h-4 w-4 mr-1`, cor 100% via `style={btnStyle(key)}`. **Removo todas as classes de cor hardcoded** (`border-orange-400`, `bg-yellow-400`, etc.). Estados `disabled`/`title` de cada botão permanecem idênticos aos atuais.

### B3. `src/components/cop/CopConfigPanel.tsx`
Acrescento ao array `BOTOES` as 7 entradas listadas no prompt (`baixar_pdf`, `particionar`, `corrigir_corte`, `registrar_perda`, `pedir_urgencia`, `enviar_oficina`, `entrega_romaneio`) com os labels indicados. Nada é removido/renomeado.

## Arquivos alterados (escopo estrito)
- `supabase/migrations/<novo>.sql` (A1)
- `src/lib/cop.ts` (A2, só adições)
- `src/components/cop/PedirUrgenciaDialog.tsx` (novo, A3)
- `src/components/cop/RomaneioTab.tsx` (A4 + B2)
- `src/hooks/use-cop-color-settings.ts` (B1)
- `src/components/cop/CopConfigPanel.tsx` (B3)

Não toco em: `src/lib/cop-saldos.ts`, `src/lib/pedidos.ts`, PCP, MAP, PDF do romaneio, lógica de recebimento/perdas/pagamento/particionamento.

## O que NÃO faço
- Não mudo status, datas, previsões, ordenação, filtros.
- Não envio notificação/e-mail/WhatsApp.
- Não crio tabela nova nem altero RLS.
- Não altero o PDF do romaneio.
- Não altero comportamento/condições dos botões existentes — só a aparência.

## Perguntas antes de codar
Nenhuma — o prompt é exaustivo. Só sigo após sua aprovação explícita.
