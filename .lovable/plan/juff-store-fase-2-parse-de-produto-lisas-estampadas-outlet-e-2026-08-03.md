# Juff Store fase 2 — parse de produto, Lisas × Estampadas, Outlet e reconhecimento na importação

Tarefa 100% front-end. Nenhuma migração, nenhum `ALTER`, nenhuma mudança de RLS, nenhuma mudança no que é gravado em `olist_pedidos`/`olist_itens`. Só os 5 arquivos autorizados.

## Arquivos alterados

**1. `src/lib/indicadores-store.ts` (novo) — fonte única da regra**

- `TipoPecaStore`, `ProdutoStore`, `parseProdutoStore(descricao)` com cache `Map<string, ProdutoStore>`.
- Importa `REFACAO_TAMANHOS`/`REFACAO_CORES` de `@/lib/pedidos` e `isItemJuffStore`/tipos de `@/lib/indicadores-olist` (só leitura, sem duplicar regra).
- Agregações puras sobre `PedidoFiltrado`: `rankingStore(pedidos, dim)` para `"modelo_base" | "estampa" | "cor" | "tamanho" | "peca"`, `composicaoStore(pedidos)` e `descricoesForaPadrao(pedidos)`. `ranking()` de `indicadores-olist.ts` fica intocada.
- Tipo auxiliar `ItemStoreCalc = ItemCalc & { store: ProdutoStore }` — compatível com `ItemCalc`, então todo o pipeline atual continua aceitando os itens.

`parseProdutoStore`, passo a passo (com os casos do item 7 do prompt):

```text
1. normaliza p/ comparação (sem acento, minúsculas, espaços colapsados); guarda original
2. remove prefixo "Juff Store" + separador
3. split por " - " (aparas de espaço); resolve os DOIS últimos pedaços:
     último ∈ tamanhos            -> tamanho = último, cor = penúltimo (se ∈ cores)
     último ∈ cores e penúltimo ∈ tamanhos -> inverte
     nenhum caso                  -> ok=false, motivo="Cor/tamanho fora do padrão", cor/tamanho null
   cor devolvida com o nome canônico de REFACAO_CORES; tamanho canônico de REFACAO_TAMANHOS
4. resto (pedaços iniciais) -> is_outlet = contém "outlet"; is_xtra = contém "xtra"
5. tipo_peca = LISA se contém "lisa"/"lisas" OU is_outlet; senão ESTAMPADA
6. modelo_base: primeiro match testando nomes mais longos primeiro
   (Camiseta Infantil, Manga Longa Masculina/Feminina, Regata Masculina/Feminina/Cross/Wing,
    Baby Look, Camiseta). Nenhum -> null, ok=false, motivo="Modelo não reconhecido"
7. estampa: resto menos modelo_base, "ThermoAir", "Kit", "Lisa(s)", "Outlet", "Xtra",
   hífens soltos e espaços duplos; vazio -> null. LISA -> sempre null
```

Confere: `...Camiseta ThermoAir Kit Outlet - verde água - G` → Camiseta / LISA / outlet / estampa null; `...Camiseta Infantil ...` → Camiseta Infantil; `...Regata Masculina ThermoAir Xtra - Kit Lisas  - EXG - turquesa` → EXG + turquesa invertidos, xtra, LISA, ok; `...Baby Look ThermoAir - BTZ Play Hard - Preto - P` → Baby Look / ESTAMPADA / estampa "BTZ Play Hard".

**2. `src/components/pcp/IndicadoresTab.tsx` — só o escopo `"store"`**

- Após o recorte de escopo já existente, quando `escopo === "store"` a base é remapeada: cada item recebe `store = parseProdutoStore(descricao_original ?? produto_olist)` e passa a usar `modelo = store.modelo_base` (ou `"Não classificado"`), `cor`/`tamanho` do parse com fallback no valor atual. `qtd`, `subtotal` e todos os valores financeiros ficam idênticos — o parse só classifica.
- Filtros novos, renderizados apenas no escopo Store: **Tipo de peça** (Todas/Lisas/Estampadas) e checkbox **Somente Outlet**. Ambos atuam no remapeamento da base (descartam os itens que não casam, pedido sem item restante sai), então `aplicarFiltros`, resumo, mensal, rankings, grades, ABC, clientes, vendedores e frete recalculam sozinhos, com o mesmo rateio de desconto de hoje. Escopo Custom não vê nem filtro nem remapeamento.
- Filtro **Modelo** no escopo Store passa a ser alimentado pelos `modelo_base` do período; `olist_produto_map` não é usado em nada nessa aba.
- Bloco novo **"Composição Juff Store"** logo após o Resumo: Lisas × Estampadas (faturamento, peças, pedidos, ticket, preço médio, % ) + card **Outlet** apresentado como recorte das Lisas.
- Rankings da aba Store: Modelos (modelo_base), **Estampas** (só ESTAMPADA), Cores, Tamanhos, Peças (`modelo · cor · tamanho`, com marca Lisa/Estampada) — via `rankingStore`, no mesmo componente de ranking já usado (ordenação/drill preservados).
- Bloco novo no fim, informativo: **"Descrições fora do padrão"** (descrição, motivo, linhas, peças), com texto deixando claro que esses itens somam normalmente em faturamento e peças.

**3. `src/lib/indicadores-pdf.ts`**

- Campos opcionais `composicaoStore?` e `rankingEstampas?`, renderizados só quando presentes, no mesmo padrão de `ufs`/`producao`/`saude`. Nenhuma outra mudança de layout.

**4. `src/lib/olist-vendas.ts`**

- Adição de `ResumoStoreImport` e do campo `store` em `ResultadoImportacaoVendas` (aditivo, nada renomeado ou removido).
- Itens reconhecidos por `isItemJuffStore` saem de `produtosSemMapeamento` e são classificados por `parseProdutoStore`, alimentando pedidos/itens/peças/lisas/estampadas/outlet/modelos/foraPadrao.
- A gravação não é tocada: as mesmas linhas, com os mesmos `descricao_original` e `produto_olist`, continuam sendo inseridas. A mudança vive só na montagem do resumo de prévia.

**5. `src/components/pcp/ImportacaoOlistTab.tsx`**

- Card novo **"Juff Store (e-commerce)"** com pedidos, itens, peças, quebra Lisas/Estampadas/Outlet e modelos base, com nota de que esses pedidos não passam pelo PCP.
- Alerta vermelho de "produto(s) sem mapeamento" passa a contar/listar só atacado; novo alerta **warning** (não bloqueante) para descrições da Store fora do padrão.
- No quadro de conferência com o PCP, os pedidos da Store saem de "Somente na Olist", com rótulo explicando que a comparação vale só para o atacado. Confirmar continua gravando exatamente como hoje.

## Não tocados

`indicadores-olist.ts`, `pedidos.ts`, `cop-saldos.ts`, `cop.ts`, `map.ts`, `estoque-olist.ts`, `src/routes/_authenticated/index.tsx`, tudo em `src/components/cop/` e `src/components/map/`, demais abas do PCP.

## Verificação

Conferir os 5 casos de parse do item 7; faturamento total da aba Store idêntico ao de antes desta fase; aba Custom inalterada; "Somente Outlet" recalculando todos os blocos; prévia da importação sem nenhuma descrição "Juff Store" no alerta de sem mapeamento e sem pedidos Store em "Somente na Olist"; typecheck limpo.

## Dúvida

Item com `ok = false` entra nos rankings como uma linha "Não classificado" (some no faturamento, visível e rastreável) em vez de ficar de fora como acontece hoje com produto sem mapeamento. Se preferir que fique fora dos rankings e apareça só no bloco de diagnóstico, ajusto.
