# Separar Indicadores em "Juff Custom" e "Juff Store"

Duas abas de admin no PCP, alimentadas pela mesma consulta (cache compartilhado), com corte **por pedido inteiro**: qualquer pedido com ao menos um item "Juff Store" sai por completo da aba Custom e vive só na aba Store.

Sem banco, sem migração, sem RLS. Só front-end, nos 4 arquivos autorizados.

## Arquivos alterados

**1. `src/lib/indicadores-olist.ts`**
- `descricao_original?: string | null` acrescentado (opcional) em `ItemDb` e `ItemCalc`; `calcularPedidos` copia o campo para o item calculado. Nenhuma chamada existente quebra.
- `export type EscopoIndicadores = "custom" | "store"`.
- `isItemJuffStore(texto)`: normaliza (sem acento, minúsculas, espaços colapsados) e testa se contém `"juff store"`.
- `pedidosJuffStore(itens: ItemDb[]): Set<string>`: percorre os itens vigentes e devolve os `numero_pedido` cujo `descricao_original` **ou** `produto_olist` bate na regra.

**2. `src/components/pcp/IndicadoresTab.tsx`**
- Assinatura: `IndicadoresTab({ escopo = "custom" }: { escopo?: EscopoIndicadores })`.
- Query base continua única (`["indicadores-olist","base"]`), só somando `descricao_original` ao `select` de `olist_itens` e devolvendo `pedidosStore: Set<string>` calculado sobre os itens vigentes.
- Logo após `calcularPedidos`, a base do componente é recortada: `store` mantém só os pedidos em `pedidosStore`; `custom` mantém só os de fora. `primeiraCompraPorCliente` passa a ser calculada **sobre a base já recortada**, então novo/recorrente é medido dentro do próprio escopo.
- No escopo `store`: `ctx.noPcp` vira `new Set()`, `grupos` é fixado em `["casados","so_olist"]` e o filtro "Grupos" não é renderizado.
- Blocos escondidos em `store`: 6 (Distribuição geográfica), 7 (Vendido × Produzido), 8 (Produção e prazo), 9 (Saúde do cadastro) e o painel "Somente PCP". Bloco 10 (Frete) fica, sem a quebra por UF.
- Os `useMemo` de `porUf`, `vendidoVsProduzido`, `produtividadePcp`, `saudeCadastro` e os derivados de `pcpLista`/`pcpPorPedido` passam a curto-circuitar (retornam vazio) quando `escopo === "store"`, sem custo de cálculo.
- Drill-downs remanescentes no escopo Store não recebem colunas de PCP.
- Rótulo no topo, no padrão visual já usado no arquivo: "Indicadores — Juff Custom (atacado · sincronizado com o PCP)" ou "Indicadores — Juff Store (e-commerce · independente do PCP)".

**3. `src/lib/indicadores-pdf.ts`**
- `ufs`, `vendidoProduzido`, `producao`, `saude` viram opcionais; ausentes, as seções não são renderizadas.
- Novo `escopoLabel: string`, exibido sob "Painel de Indicadores" e usado no nome do arquivo (`indicadores-juff-store-...`).
- No escopo Store, a linha de "Grupos" nos filtros é omitida. Nenhuma outra mudança de layout.

**4. `src/routes/_authenticated/index.tsx`**
- Aba `indicadores` passa a se chamar "Indicadores Juff Custom" e renderiza `<IndicadoresTab escopo="custom" />`.
- Nova aba `indicadores_store`, label "Indicadores Juff Store", logo depois, com `<IndicadoresTab escopo="store" />`, seguindo o mesmo padrão `{isAdmin && tab === ... && (...)}`. Ambas restritas a admin.

## Não tocados

`cop-saldos.ts`, `cop.ts`, `map.ts`, `pedidos.ts`, `estoque-olist.ts`, `olist-vendas.ts`, tudo em `src/components/cop/` e `src/components/map/`, `ImportacaoOlistTab.tsx` (importação continua trazendo tudo, sem filtro) e as demais abas do PCP.

## Verificação

Somar faturamento/peças/pedidos das duas abas no mesmo período e conferir com o total de hoje; confirmar que um pedido Store não aparece em nenhum bloco/ranking/drill do Custom; conferir que a aba Store não tem filtro de Grupos nem blocos de PCP; gerar o PDF nas duas abas; typecheck limpo.

## Dúvida única

Frete e descontos do pedido misto (item Store + itens de atacado) vão inteiros para a aba Store, conforme sua decisão de corte por pedido — sigo assim, sem rateio.
