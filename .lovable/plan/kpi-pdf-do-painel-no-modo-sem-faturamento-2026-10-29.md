# KPI — PDF do painel no modo sem faturamento

Só 3 arquivos. Sem migração, sem SQL, nenhum cálculo muda.

## 1. src/components/kpi/IndicadoresTab.tsx
- Tirar o `{mostrarFat && (<> ... </>)}` em volta do botão "Exportar PDF" (linha ~905) e do botão "PDF por faixa" (linha ~1809). Os dois voltam a aparecer sempre.
- `exportarPdf`: acrescentar `mostrarFaturamento: mostrarFat` no objeto de `abrirIndicadoresParaImpressao`.
- `exportarPdfFaixas`: o mesmo em `abrirFaixasQtdParaImpressao`.
- Nenhum outro uso de `mostrarFat` é tocado.

## 2. src/lib/indicadores-pdf.ts
- `IndicadoresPdfDados.mostrarFaturamento?: boolean` (omitido = true).
- `kpis(d)`: reescrito como no pedido — o valor atual vai dentro do item, o array paralelo `atual` sai; com olho fechado só Pedidos e Peças vendidas.
- `corpoHtml`: auxiliares `mFat`, `hFat(...)`, `moedaC(v)`.
- Composição Store, Estampas, Rankings (subtítulo novo sem fat), Curva ABC, Clientes, Vendedores (subtítulo novo sem fat), Saúde do cadastro (sem mapeamento): cabeçalhos com `hFat` e células monetárias só quando `mFat` (a célula some, não fica vazia; na Outlet o "—" de ticket só sai com `mFat`).
- Bloco Faturamento (mês + Por situação): string vazia quando `!mFat`.
- Frete: com `mFat` igual a hoje; sem fat + `d.ufs` → "Distribuição por UF" (UF, Pedidos, Peças, % receita); sem fat sem `d.ufs` → some.
- Vendido × Produzido e Produção e prazo: não tocados.
- Nome do arquivo ganha `-sem-faturamento` quando `mostrarFaturamento === false`.

## 3. src/lib/faixas-qtd-pdf.ts
- Campo `mostrarFaturamento?: boolean`; `mFat`/`moedaC` em `corpoHtml`.
- Cabeçalho, linhas e Total sem Faturamento, % faturamento, Ticket médio e Preço médio/peça quando olho fechado (células removidas, não vazias). % pedidos fica.
- Sufixo `-sem-faturamento` no nome do arquivo.

## Detalhe técnico
Onde hoje uma célula é `<td>${moeda(x)}</td>`, a troca será por `${mFat ? `<td>${moeda(x)}</td>` : ""}` para que a célula inteira desapareça (usar só `moedaC` deixaria `<td></td>` vazio e violaria o critério 8). No fim: typecheck + diff em /mnt/documents/diff-kpi-pdf-sem-faturamento.diff.
