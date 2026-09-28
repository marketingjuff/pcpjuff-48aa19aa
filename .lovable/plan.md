# MAP — Botão "+" na faixa de data para criar Prod naquela data

Sem migração, sem SQL. Só 2 arquivos alterados.

## 1. `src/components/map/NovoProdDialog.tsx`
- `Props` ganha `dataPedidoInicial?: string | null;` e o componente passa a recebê-la.
- No `useEffect` de preenchimento, ramo de criação: `setDataPedido(dataPedidoInicial || hoje);`.
- Dependências do efeito: `[open, producao?.id, dataPedidoInicial]`.
- Ramo de edição, numeração e `handleSave` não mudam.

## 2. `src/components/map/ProgramacaoFiosTab.tsx`
- Novo estado `novoProdData` (`string | null`), ao lado de `dlgOpen`/`editingProd`.
- `openNovo` zera `novoProdData`; nova `openNovoEmData(data)` define a data; `openEditar` zera `novoProdData`.
- A faixa amarela do grupo vira `flex items-center justify-between gap-3`: o texto fica num `<span>` e o botão "+" (`Button` outline sm, `Plus`, title "Adicionar Prod em DD/MM/AAAA") aparece à direita só quando `!finalizado`.
- `<NovoProdDialog>` recebe `dataPedidoInicial={novoProdData}`, e as outras props ficam como estão.
- Sem imports novos (`Button` e `Plus` já estão importados).

## Verificação
Typecheck (`tsgo`) e diff dos 2 arquivos entregues no fim.
