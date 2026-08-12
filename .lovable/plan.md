# Faixas de tamanho de pedido — KPI Juff Custom

Segmentar os pedidos do painel de Indicadores do **Juff Custom** por quantidade de peças do pedido (`pecasSel`), com um filtro novo e um quadro novo. No escopo **Juff Store** nada muda. Sem migração — cálculo 100% em memória.

## Arquivos

- `src/lib/indicadores-olist.ts` — apenas adições no fim do arquivo
- `src/components/kpi/IndicadoresTab.tsx`

## 1. Biblioteca (adições no fim de `indicadores-olist.ts`)

- `type FaixaQtd` = `"todas" | "ate9" | "f10_50" | "f51_100" | "f101_200" | "f201_300" | "f301_400" | "f401_500" | "f501_1000" | "acima1000"`.
- `FAIXAS_QTD`: 9 faixas na ordem da tabela, com `label`, `min`, `max` (`Infinity` na última).
- `faixaDoPedido(p)` → faixa a partir de `p.pecasSel`, ou `null` quando `pecasSel <= 0`.
- `filtrarPorFaixaQtd(pedidos, f)` → array original quando `f === "todas"`; senão só os pedidos da faixa (pedidos com 0 peças ficam fora).
- `LinhaFaixaQtd` + `porFaixaQtd(pedidos)` → sempre as 9 faixas (inclusive zeradas) com `pedidos`, `pecas` (Σ `pecasSel`), `faturamento` (Σ `liquidoSel`), `ticket` (faturamento/pedidos, 0 sem pedidos), `pctPedidos` e `pctFaturamento` sobre o total das faixas.

Nenhuma função existente (`aplicarFiltros`, `resumo`, `porVendedor`, `ranking`) é alterada.

## 2. Filtro na barra

- State `faixaQtd` (`"todas"` por padrão).
- `<Select>` "Faixa de pçs" na segunda linha de filtros, logo após o MultiSelect "Situação", só quando `soPcpAtivo`, com `SelectTrigger className="h-9 w-[150px] text-xs"` e os 10 itens.
- Guardar os memos atuais como `atuaisSemFaixa` / `anterioresSemFaixa` (resultado de `aplicarFiltros` + `filtrarPorVendedor`) e derivar `atuais` / `anteriores` aplicando `filtrarPorFaixaQtd(..., faixaQtd)`, com `faixaQtd` nas dependências. Assim todos os blocos existentes recortam automaticamente, sem duplicar lógica.

## 3. Quadro "Faixas de tamanho de pedido"

- `<Card>` imediatamente após o Bloco 5 — Vendedores, só quando `soPcpAtivo`. Descrição: "Peças por pedido · período e demais filtros aplicados".
- Dados de `porFaixaQtd(atuaisSemFaixa)` — o quadro mostra sempre o mapa completo, mesmo com uma faixa selecionada.
- Tabela no padrão de Vendedores (`tbl-congelada w-full text-xs`, `px-2 py-1`, números `tabular-nums` à direita): `Faixa | Pedidos | % pedidos | Peças | Faturamento | % faturamento | Ticket médio`, com linha de Total (`border-t-2`, negrito) e ticket geral.
- `Pedidos`, `Peças` e `Faturamento` com `ValorDrill` + `drillPedidos` filtrando `atuaisSemFaixa` pela faixa, `subtitulo: subOlist`, títulos como `Faturamento — 101 a 200 pçs`.
- Célula "Faixa" clicável: aplica a faixa no filtro; clicar de novo volta para "todas". Linha selecionada destacada (`bg-muted/50` + negrito). Faixas zeradas sem drill.

## Fora de escopo

Exportação em PDF, `KpiPcpTab.tsx`, `ImportacaoOlistTab.tsx`, dashboards de PCP/COP/SUP, novos gráficos.
