# Filtro de Vendedor unificado (Olist + PCP) no Painel de Indicadores

O filtro **Vendedor** passa a oferecer a união dos vendedores da Olist e dos vendedores cadastrados no PCP, casando por chave normalizada (sem acento, sem caixa, sem espaço sobrando). Um pedido entra no recorte quando o vendedor da Olist **ou** o vendedor do PCP está selecionado.

Somente leitura. Sem migração, sem SQL, sem nova consulta.

## Arquivos

Novo:
- `src/lib/indicadores-vendedor.ts` — funções puras:
  - `chaveVendedor(nome)` — trim + maiúsculas + remoção de acentos
  - `OpcaoVendedor { chave; label; origem: "olist" | "pcp" | "ambos" }`
  - `opcoesVendedores(olist, pcp)` — união deduplicada, rótulo mais legível, ordem pt-BR
  - `mapaVendedorPcp(pcp)` — `pedido_olist` → vendedor do PCP
  - `filtrarPorVendedor(pedidos, selecionados, vendedorPcpPorPedido)` — regra de união; seleção vazia devolve a lista intacta
  - `pcpNoRecorteVendedor(reg, selecionados)` — seleção vazia sempre true

Editados:
- `src/components/pcp/IndicadoresTab.tsx`
- `src/lib/indicadores-pdf.ts` — apenas a string da linha 302 do bloco de produção

Já resolvido: a coluna `vendedor` **já está** no `select` de `pedidos` e no tipo `PcpDrill`, então nenhuma mudança de consulta é necessária.

## Mudanças em IndicadoresTab.tsx

1. `opcoes.vendedores` passa a usar `opcoesVendedores(base, data?.pcpLista ?? [])`.
2. O estado `vendedores` guarda **chaves normalizadas**. O `MultiSelect` local ganha suporte opcional a opções em objeto (`{ valor, label, hint }`) mantendo o mesmo visual, altura, largura mínima e botão "Limpar"; os outros filtros continuam passando `string[]`.
3. `aplicarFiltros` é chamado com `{ ...filtros, vendedores: [] }` e o recorte por vendedor é aplicado depois via `filtrarPorVendedor(...)`, em `atuais` e em `anteriores`. Assim `indicadores-olist.ts` fica intocado.
4. `pcpPeriodo` ganha a condição `pcpNoRecorteVendedor(r, vendedores)` — é o que faz o Bloco 8 respeitar o filtro.
5. O card "Somente PCP" filtra a lista de números pelo vendedor do PCP.
6. Texto do Bloco 8 atualizado: os filtros de empresa, modelo, cor, tamanho e situação não valem ali, mas o de Vendedor vale e usa o vendedor cadastrado no PCP.
7. No PDF, `filtros.vendedores` envia os **labels** legíveis, não as chaves.

## Fora de escopo

`indicadores-olist.ts` (só importado), demais libs, todas as outras abas de PCP/COP/MAP, `src/components/ui/*`, migrações. Nenhum outro filtro muda. Vendedor do PCP nunca entra em faturamento, ticket ou ranking — serve só para casar o filtro.

## Verificação

Com o filtro vazio, todos os blocos — inclusive o 8 — devem bater exatamente com os números de hoje. Selecionar um vendedor que só existe no PCP deve recortar o Bloco 8 e o card "Somente PCP". Typecheck limpo.
