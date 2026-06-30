# COP — Corrigir Corte, Registro de Perdas e Pagamento

Mudanças apenas no COP. PCP intocado. Banco aditivo: 1 coluna nova.

## Migração (única)

```sql
ALTER TABLE public.cops
  ADD COLUMN IF NOT EXISTS corte_em_correcao boolean NOT NULL DEFAULT false;
```

## Permissões

Trocar `isAdmin` por `useCanAccessCop()` (admin OU gestor com área "cop") em todas as ações tocadas: Corrigir corte, Voltar para o Romaneio, Registrar/editar perda, remover perda, liberar pagamento, marcar como pago, reverter pagamento, apagar pagamento. Nada fora do COP é alterado.

## Pedido 1 — "Corrigir corte" substitui "Voltar para Corte"

`src/components/cop/RomaneioTab.tsx` e `src/components/cop/CorteTab.tsx`.

- Renomear botão para **"Corrigir corte"** no Romaneio.
- Remover a lógica destrutiva `voltarParaCorte` (zerar oficina/datas/recebidas/conferência/pagamento e deletar filhos). Substituir por: `UPDATE cops SET corte_em_correcao = true` e levar usuário para a aba Corte (via `onSelect` + troca de tab no `CopHome`, se aplicável; mínimo: marcar a flag e mostrar toast).
- Enquanto `corte_em_correcao = true`:
  - **Romaneio:** card desse COP em modo somente-leitura, com aviso visível "Em correção de corte" (desabilitar inputs/botões salvo navegação).
  - **Corte:** edição habilitada mesmo com status pós-corte. Por linha (modelo|cor|tamanho) a `qtd` não pode ser menor que `qtd_recebida` em `pecas_recebidas`. Permite acrescentar/diminuir o restante.
- Novo botão **"Voltar para o Romaneio"** na aba Corte, visível só quando `corte_em_correcao = true`: salva peças ajustadas, marca `corte_em_correcao = false`. Mantém oficina, datas, recebidas, conferência, pagamento e filhos.
- Invariante reforçada na hora de salvar peças: nunca `qtd_recebida > qtd`.

## Pedido 2 — Registrar perda no Romaneio

`src/components/cop/RomaneioTab.tsx`, novo `RegistrarPerdaDialog.tsx`, `src/components/cop/PerdasTab.tsx`, `src/lib/cop-saldos.ts`, `src/components/cop/DisponivelTab.tsx`.

- Botão cinza medio **"Registrar perda"** ao lado de "Corrigir corte" no Romaneio.
- Dialog lista TODAS as peças do COP (`cop.pecas`) com input de qtd perdida, pré-preenchido com o que já existe em `cop.perdas`. Editável a qualquer momento.
- Persistir em `**cops.perdas**` (jsonb) como `[{ modelo, cor, tamanho, qtd }]` (linhas com 0 são removidas). Sem `DELETE`; é UPDATE do array inteiro do próprio COP. Não usar `cop_perdas` aqui.
- Ao salvar, reescrever um resumo automático em `observacoes_romaneio` em MAIÚSCULAS, no formato `PERDAS: 2 CAMISETA PRETA M, 1 REGATA AZUL G`. Preservar texto anterior do usuário separando a linha de PERDAS (gerar/substituir bloco delimitado, ex.: linhas iniciadas com `PERDAS:` são sobrescritas; resto do texto preservado).
- `PerdasTab`: listar também perdas vindas de `cops.perdas` (COP, oficina, data do romaneio, item, qtd), unidas ao histórico de `cop_perdas`. Remover a frase "Apenas registro: não altera saldo Disponível".
- `cop-saldos.ts`:
  - Adicionar `calcPerdas(cops): Map<M·C·T, number>` somando `cops[].perdas`.
  - `calcDisponivel = produção − faltantes − baixado − perdas`.
  - `DisponivelTab` mostra a nova coluna/parcela "Perdas".

## Pedido 3 — Pagamento Oficinas

`src/components/cop/PagamentoOficinasTab.tsx`.

- Remover etapa de conferência (coluna "Conferida" editável e botão "Salvar conferência").
- Layout compacto: uma linha por **modelo+cor** (soma todos os tamanhos). Colunas: Modelo · Cor · Qtd · Valor/un · Subtotal.
- `qtd_pagavel(m,c) = Σ_tamanho max(0, recebido(m,c,t) − perda(m,c,t))`.
- `calcValor` usa `recebido − perdas` (não `conferencia`). Valor = `qtd_pagavel × oficina.valores_por_modelo[modelo]`.
- Manter input `num_fretes` no rodapé (única coisa editável aqui além das ações de pagamento).
- Status **"Pagamento atrasado"** (calculado, sem coluna):
  - Se `pagamento_status === "liberado"` e `hoje > addDiasUteis(pagamento_liberado_em, 5, feriados)` → atrasado.
  - Usar `addDiasUteis` de `src/lib/dias-uteis.ts` com a lista de feriados do hook existente (`use-feriados`).
  - Badge vermelho "Pagamento atrasado" no card e na lista; nova opção "Atrasado" no filtro de status.
  - Some quando `pagamento_status === "pago"`.

## Resumo do schema

- Adiciona `cops.corte_em_correcao boolean default false`.
- Nada mais. `cops.perdas` e `cop_perdas` já existem. "Atrasado" é derivado.

Aprove para eu implementar.