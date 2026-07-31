# FASE 5 — Painel: cruzamento com o PCP

Quatro blocos novos na aba **Indicadores** (só admin), abaixo dos blocos comerciais da fase 4. Nada dos blocos existentes muda de cálculo.

## Arquivos

```
ALTERAR: src/lib/indicadores-olist.ts          (novas funções puras, nenhuma existente alterada)
ALTERAR: src/components/pcp/IndicadoresTab.tsx (leitura extra do PCP + 4 blocos novos)
```

Sem migração: nenhuma tabela, coluna ou policy nova.

## Dados adicionais lidos

A consulta do PCP hoje traz apenas `pedido_olist` e `uf_entrega`. Passa a trazer também (mesma leitura paginada de 1000 em 1000): `qtd`, `entrada_pedido`, `data_entrega`, `inicio_estamparia`, `termino_estamparia`, `inicio_acabamento`, `termino_acabamento`, `saida_juff`, `finalizado_em`, `arte_data`, `refacoes`, `correcoes_etapa`. Feriados via o hook já existente, para os dias úteis.

## Bloco 6 — Distribuição geográfica

Receita, pedidos e peças por UF de entrega, sempre vinda de `pedidos.uf_entrega` do PCP — nunca do arquivo da Olist. Pedido sem par no PCP entra como "—". Tabela ordenável + gráfico de barras das 10 maiores UFs. Reaproveita `resumoFrete`, acrescentando as colunas de receita e participação.

## Bloco 7 — Vendido × Produzido

- Somente pedidos do grupo **casados** (existem na Olist e no PCP). Sem os dois lados, fora da comparação.
- **Peças vendidas** = Σ `qtd` dos itens da Olist com `is_servico = false`.
- **Peças produzidas** = `pedidos.qtd` do PCP.
- **Peças perdidas** = Σ `perda_pecas` de todos os episódios do array `refacoes` (as perdas vivem dentro de cada episódio; `pecas_perdidas` é apenas o detalhe opcional por modelo/cor/tamanho, não uma fonte separada). `perda_adesivos` e `qtd_falta_adesivos` nunca são somados entre si e nunca entram na contagem de peças. Terceira coluna, explicativa.
- Comparação por **totais**, sem quebra por modelo/cor/tamanho.
- A diferença (absoluta e percentual) aparece como informação **neutra**: sem alerta, sem cor de erro, sem bloqueio, com uma linha de texto lembrando que perdas e refações fazem a produção superar a venda.
- Visão consolidada do período + série mensal (vendidas · produzidas · perdidas · diferença).

## Bloco 8 — Produção e prazo (só PCP)

Independente da Olist; usa todos os pedidos do PCP no período.

- Prazo médio de entrada até saída, em **dias úteis** (`@/lib/dias-uteis`, com feriados).
- Tempo médio por etapa (arte, estamparia, acabamento, expedição) e destaque do gargalo.
- Pontualidade contra `data_entrega`: % no prazo, média de dias de atraso.
- Listas de pedidos atrasados e em risco.
- Refações por área, a partir de `refacoes`.
- Correções de etapa, a partir de `correcoes_etapa`.

## Bloco 9 — Saúde do cadastro

Quatro contadores, cada um com lista detalhada expansível:

1. Pedidos somente na Olist.
2. Pedidos somente no PCP.
3. Produtos sem mapeamento (`olist_produto_map`), com peças e receita envolvidas.
4. Divergências de quantidade entre Olist e PCP nos pedidos casados, com o valor de cada lado.

Tudo apresentado como diagnóstico de cadastro, sem semântica de erro.

## Detalhes técnicos

- Novas funções puras em `indicadores-olist.ts`: `porUf`, `vendidoVsProduzido` (+ série mensal), `produtividadePcp`, `saudeCadastro`. Continuam operando sobre arrays já filtrados, para a fase 6 (PDF) reaproveitar sem recalcular.
- Recorte de período: pedidos da Olist pela `data` (como hoje); pedidos do PCP por `entrada_pedido`. Os blocos de prazo e pontualidade usam as datas próprias de cada etapa dentro desse recorte.
- Casamento Olist ↔ PCP por `pedido_olist`, com fallback em `orcamento`, no mesmo padrão já usado no painel.
- Tabelas no padrão `.tbl-congelada` com `SortTh`/`useTableSort`; gráficos com `recharts`.
- Filtros existentes continuam valendo; empresa e vendedor não recortam o bloco 8, que é exclusivamente PCP — isso fica indicado no cabeçalho do bloco.
