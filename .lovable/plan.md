# Filtro "Faixa de Qtd" no Dashboard Master (PCP)

Único arquivo alterado: `src/components/pcp/DashboardTab.tsx`. Sem migração, sem backend.

## O que será feito

1. Novo tipo `FaixaQtd` no topo do arquivo (união: `todas`, `ate9`, `f10_50`, `f51_100`, `f101_200`, `f201_300`, `f301_400`, `f401_500`, `f501_1000`, `acima1000`).
2. Função pura `pedidoNaFaixa(p, f)` usando `totalProducao(p).total` (mesmo número da coluna QTD). Pedidos com total 0 só aparecem em "Todas as faixas".
3. `totalProducao` adicionado ao import existente de `@/lib/pedidos`.
4. Novo state `faixaQtd` (default `"todas"`), aplicado no `useMemo` de `filtrados` em AND com os demais filtros, incluído nas dependências.
5. Novo `Select` "Faixa de Qtd" logo após "Status Peças" e antes de "Data Entrega", no mesmo padrão visual dos outros; grid passa de `lg:grid-cols-6` para `lg:grid-cols-7`.
6. "Limpar Filtros" também reseta a faixa.

## Fora de escopo

Cards de estatística do topo, contadores por faixa, ordenação, colunas e outros dashboards (COP, SUP) permanecem intactos.
