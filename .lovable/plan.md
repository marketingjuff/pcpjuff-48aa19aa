# FASE 4 — Painel de Indicadores (blocos comerciais)

Nova aba **Indicadores** no PCP, visível somente para admin, com filtros no topo e os blocos comerciais + rankings, calculados sobre os dados da Olist já importados (fases 1-3).

## Arquivos

```
CRIAR:   src/lib/indicadores-olist.ts           (tipos, filtros e todas as agregações)
CRIAR:   src/components/pcp/IndicadoresTab.tsx  (tela: barra de filtros + blocos)
ALTERAR: src/routes/_authenticated/index.tsx    (aba "Indicadores", só admin)
```

Nada mais é tocado. `src/lib/estoque-olist.ts`, `olist-vendas.ts` e a importação da fase 2 ficam intactos — o painel apenas lê.

## Dados lidos

- `olist_pedidos` e `olist_itens` (paginados de 1000 em 1000, como já fazemos nas outras telas)
- `olist_import_lotes` para escolher a **versão vigente** de cada pedido via `apenasVigentes` (já existe)
- `olist_pedidos_excluidos` para excluir pedidos dos indicadores por padrão
- `olist_produto_map` para modelo COP nos rankings
- `pedidos` (PCP: `pedido_olist`, `uf_entrega`) — necessário para o filtro **Grupo** (casados / só Olist / só PCP) e para a distribuição de frete por UF, já que a UF nunca vem do arquivo da Olist

## Filtros (barra fixa no topo)

Período (mês atual, mês anterior, 30/60/90 dias, ano, intervalo livre) · comparar com período anterior (liga/desliga) · Empresa (**Consolidado por padrão**, JOKE, JUFF) · Vendedor · Modelo · Cor · Tamanho · Situação (múltipla escolha) · Grupo (casados · só Olist · excluídos · só PCP).

Sem recorte automático de situação: todas aparecem e o filtro faz o corte.

O grupo **só PCP** é apenas lista e contagem: pedidos que existem no PCP e não na Olist não têm item, preço nem cliente, então ficam fora de faturamento, ticket médio, peças e rankings — não viram linhas zeradas puxando a média.

## Regras de cálculo

Faturamento em três etapas, na ordem correta (o percentual incide sobre o subtotal **depois** dos descontos de item, nunca sobre o bruto; `desconto_valor` e `desconto_percentual` são mutuamente exclusivos, só um vem preenchido):

```text
subtotal_item   = qtd × valor_unitario − desconto_item
subtotal_pedido = Σ subtotal_item
liquido_pedido  = subtotal_pedido
                  − desconto_valor
                  − (subtotal_pedido × desconto_percentual / 100)
```

- Faturamento = Σ `liquido_pedido`. **Frete e despesas fora.**
- Peças vendidas = Σ `qtd` só de itens com `is_servico = false`.
- Preço médio por peça = faturamento de produtos ÷ peças vendidas (serviços fora dos dois lados).
- Ticket médio = faturamento ÷ nº de pedidos.
- Excluídos fora de tudo por padrão; produto sem mapeamento entra no faturamento mas fica fora dos rankings de modelo.
- Tamanhos sempre na ordem de `REFACAO_TAMANHOS`; modelo/cor com `cmpModeloCor`.


## Blocos

1. **Resumo** — cartões de faturamento, pedidos, peças, ticket médio e preço médio por peça, com variação % contra o período anterior quando a comparação estiver ligada.
2. **Faturamento** — evolução mensal consolidada, participação JOKE × JUFF por mês, distribuição por situação.
3. **Produto** — composição por receita e por volume (duas ordenações) e curva ABC de modelo.
4. **Clientes** — curva ABC por `cpf_cnpj`, recorrentes × novos, maiores clientes por receita. A primeira compra de cada `cpf_cnpj` é apurada sobre o **histórico completo**, ignorando o filtro de período: quem comprou em março não é "novo" em julho. O filtro define quem aparece na lista, não quem é novo.
5. **Vendedores** — receita, pedidos, peças, ticket médio e desconto médio concedido. O desconto é convertido para uma base única (valor em reais e percentual equivalente sobre o subtotal), para que quem dá 13% e quem dá R$ 200 sejam comparáveis.
10. **Frete** — total, frete médio por pedido, % de pedidos com frete cobrado e distribuição por UF, em seção própria, **nunca somado ao faturamento**.

## Bloco 12 — Rankings (destaque próprio)

Quatro listas (modelos, cores, tamanhos, peças = modelo + cor + tamanho), cada linha com peças, participação % e faturamento. Mais duas grades cruzadas: tamanhos por modelo e cores por modelo (percentual dentro de cada modelo).

Cada ranking: ordenar por quantidade, faturamento ou nº de pedidos; exibir 10 / 20 / todas; e, com comparação ligada, posição anterior e variação.

## Detalhes técnicos

- Toda a matemática mora em `indicadores-olist.ts` como funções puras sobre arrays já filtrados — a tela só apresenta. Isso deixa a fase 6 (PDF) reaproveitar as mesmas agregações sem duplicar cálculo.
- Gráficos com `recharts`, já instalado; tabelas com o padrão `.tbl-congelada` e `SortTh`/`useTableSort` de `@/components/shared/sortable`.
- Aba e conteúdo condicionados a `isAdmin`, seguindo o padrão de "Importação Olist".
- Sem migração de banco nesta fase: nenhuma tabela, coluna ou policy nova.
