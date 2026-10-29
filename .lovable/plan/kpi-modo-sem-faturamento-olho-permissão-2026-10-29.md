# KPI — modo sem faturamento (olho + permissão)

Mostra valores em R$ somente quando: tem a permissão `kpi.faturamento` E o olho está aberto. Admin sempre tem a permissão. Só exibição; nenhum cálculo, migração ou SQL.

## Arquivos (somente a allowlist)

1. **src/lib/kpi-faturamento.tsx (novo)** — `FaturamentoProvider` + `useMostrarFaturamento()` (padrão `true` fora do provider), exatamente como no pedido.
2. **src/lib/permissoes.ts** — uma linha nova após `kpi.cop_map`: `kpi.faturamento`, `acao: true`, `nivelConfiguravel: false`, `tabValue: ""`. Presets e normalização intactos.
3. **src/routes/_authenticated/kpi.tsx** — `usePode("kpi.faturamento")`, `useState(true)` para o olho (sem localStorage), botão Eye/EyeOff antes de Configurações só para admin e só nas abas custom/store/copmap; `<Tabs>` envolvido por `FaturamentoProvider`.
4. **src/components/kpi/IndicadoresTab.tsx** — `mostrarFat` no topo e em `RankingCard`; renderização condicional nos pontos 4.1 a 4.13: botões de PDF, cards do Resumo (grid 5→2), linhas monetárias da Composição Store, cards Faturamento e Frete inteiros, tabela Composição por receita, gráfico de receita por UF, colunas em R$ (Curva ABC, Clientes, Vendedores, Faixas incl. totais, Geografia, Saúde do cadastro, Ranking) e filtro das colunas `moeda` no `abrirDrill`.
5. **src/components/kpi/KpiCopMapTab.tsx** — bloco "Dinheiro" só renderiza com `mostrarFat`.
6. **src/components/pcp/IndicadorDrillDialog.tsx** — rodapé "Indicador no painel" só aparece se `indicadorLabel` tiver texto.

## Ao final
Typecheck + diff em /mnt/documents/diff-kpi-sem-faturamento.diff.
