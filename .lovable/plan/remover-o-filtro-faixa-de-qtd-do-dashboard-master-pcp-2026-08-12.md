# Remover o filtro "Faixa de Qtd" do Dashboard Master (PCP)

Único arquivo alterado: `src/components/pcp/DashboardTab.tsx`. Sem migração, sem backend.

## O que sai

1. `type FaixaQtd`, a constante `FAIXAS_QTD` e a função `pedidoNaFaixa` no topo do arquivo.
2. State `faixaQtd` / `setFaixaQtd`.
3. A linha `if (!pedidoNaFaixa(p, faixaQtd)) return false;` no `useMemo` de `filtrados` e o `faixaQtd` das dependências.
4. O bloco do `<Select>` rotulado "Faixa de Qtd", entre "Status Peças" e "Data Entrega".
5. `setFaixaQtd("todas")` do "Limpar Filtros" (os demais resets seguem iguais).
6. `totalProducao` do import de `@/lib/pedidos` — verificado: só é usado dentro de `pedidoNaFaixa`, então o import sai também.

## Layout

7. A grid dos filtros volta para `grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6`. A grid dos cards de estatística no topo (também `lg:grid-cols-7`) fica intacta.

## Fora de escopo

KPI (`IndicadoresTab.tsx`, `indicadores-olist.ts`), `src/lib/pedidos.ts`, ordenação, contador, tabela desktop e cards mobile permanecem como estão.
