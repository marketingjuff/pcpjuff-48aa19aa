# SUP — comissão blindada + campos numéricos sem setinhas

Sem migração, sem correção de dados históricos, apenas os 6 arquivos da allowlist.

## 1. `src/lib/sup.ts` (só adição)
- Novo `comissaoPercentualEfetiva({ comissionado_id, comissao_percentual })`: retorna 0 sem comissionado.
- Novo `casasDecimaisUnidade(unidade)`: 3 para kg/litro/metro, 0 para o resto (inclusive vazio).
- Nada existente muda (`calcTotaisPedido`, `aplicarPrecoTabela`, `aplicarPrecoNegociado`, hooks).

## 2. `src/components/ui/number-input.tsx` (novo)
`NumberInput` controlado sobre o `Input`: `type="text"`, `inputMode` conforme decimais, estado de texto
local enquanto focado, aceita vírgula ou ponto, ignora outros caracteres, `decimais=0` só inteiro,
clamp de `min`/`max` no blur, vazio no blur vira 0, scroll faz blur, ↑/↓ bloqueados,
classes padrão `text-right tabular-nums min-w-[6rem]` sobrescrevíveis.

## 3. `src/styles.css`
Só o bloco das setinhas: `.cop-scope input[type="number"]` passa a `input[type="number"]` (global),
mesmas propriedades, comentário atualizado.

## 4. `src/components/sup/PedidoCompraDialog.tsx`
- Pedido novo nasce com `comissionado_id: null` e `comissao_percentual: 0` (sem o padrão de 4%).
- Pedido existente: se `comissionado_id` for nulo, força 0 em memória; com comissionado, mantém o
  percentual gravado (histórico).
- Gravação: `comissao_percentual: head.comissionado_id ? n(...) : 0`.
- Select de comissionado com percentual derivado do cadastro (fallback no padrão só quando há
  comissionado).
- Campo "% comissão" deixa de ser input: admin vê `X,XX%` somente leitura; não admin vê apenas
  "Comissionamento: Sem comissão / Com comissão — Nome", com o select desabilitado. Economia e comissão
  prevista continuam só para admin.
- `calcTotaisPedido` no dialog passa a receber a comissão efetiva.
- Frete, desconto global, quantidade, preço de tabela, preço negociado e quantidade recebida viram
  `NumberInput` (quantidades com casas conforme a unidade, recebida com `max` mantendo o `Math.min`).
- Colunas de quantidade ganham largura para 5 dígitos.

## 5. `src/components/sup/PedidosCompraTab.tsx`
Só o `calcTotaisPedido` da listagem passa a usar a comissão efetiva.

## 6. `src/components/sup/SupConfigTab.tsx`
Dias de carência → `NumberInput decimais={0} min={0}`; percentual do comissionado e percentual padrão →
`NumberInput decimais={2} min={0} max={100}`, mesma lógica de gravação.

## Fora de escopo
`ComissoesTab.tsx` só será conferido (leitura). `cop-saldos.ts`, PCP, COP e MAP não são tocados.
