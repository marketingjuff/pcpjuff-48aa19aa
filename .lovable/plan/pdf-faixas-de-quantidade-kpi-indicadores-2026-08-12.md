# PDF "Faixas de quantidade" (KPI › Indicadores)

Sem migração, 100% front-end. Arquivos: **criar** `src/lib/faixas-qtd-pdf.ts`, **editar** `src/components/kpi/IndicadoresTab.tsx` (dois pontos). Nenhum outro arquivo é tocado.

## 1. `src/lib/faixas-qtd-pdf.ts` (novo)

Exporta `abrirFaixasQtdParaImpressao(d)` no mesmo molde de `abrirIndicadoresParaImpressao`: monta HTML string, `window.open`, `document.write`, `setTimeout(() => window.print(), 350)`, alerta se o popup for bloqueado. Título/arquivo: `faixas-quantidade-{de}-a-{ate}`.

Tipo de entrada:

- `periodo: { de: string; ate: string }`
- `filtros: { empresa, vendedores, modelos, cores, tamanhos, situacoes, grupos }` (mesmo formato do PDF atual)
- `linhas`: as linhas de `porFaixaQtd` já calculadas na tela + `precoMedio` + `topModelo: { nome, pecas } | null`
- `totalTopModelo: { nome, pecas } | null`

Conteúdo (uma página A4 retrato, CSS copiado do exportador atual, versão reduzida):

- **Cabeçalho**: logo `loguinhojuffpreto`, título "Faixas de quantidade por pedido", "Juff Custom", período em DD/MM/AAAA e a linha de filtros aplicados.
- **Uma tabela**, 9 linhas fixas na ordem de `FAIXAS_QTD` (faixas zeradas aparecem com zeros): Faixa · Pedidos · % pedidos · Peças · Faturamento · % faturamento · Ticket médio · Preço médio/peça · Modelo mais vendido (`Nome (123 pçs)`, ou `—`).
- **Linha de Total** com as somas das faixas, ticket e preço médio do total, e `totalTopModelo` na última coluna.
- **Rodapé**: "gerado em {data/hora} por {e-mail}" via `supabase.auth.getUser()`.

Só formatação (`fmtNum`, `fmtMoeda` de `indicadores-olist`) — nenhum cálculo novo. Sem gráficos, sem quadros extras, sem lista de pedidos.

## 2. `IndicadoresTab.tsx`

- Novo handler `exportarPdfFaixas`: monta `linhas` a partir de `faixasLinhas` + `atuaisSemFaixa` (`faixaDoPedido` para recortar a faixa, `ranking(pedidosFaixa, "modelo")[0]` para o modelo mais vendido), `precoMedio = faturamento / pecas`, `totalTopModelo = ranking(atuaisSemFaixa, "modelo")[0]`, e o mesmo objeto `filtros` já usado em `exportarPdf` (copiado, sem refatorar o existente). Chama `abrirFaixasQtdParaImpressao`.
- `CardHeader` do card "Faixas de tamanho de pedido" passa a `flex items-start justify-between`, com botão `outline`/`sm` "PDF por faixa" (`FileDown`, `disabled={isLoading}`) à direita do título. A faixa selecionada na tela é ignorada no PDF.

## Fora de escopo

`indicadores-olist.ts`, `indicadores-pdf.ts`, o painel de PCP e qualquer outro card permanecem intactos.
