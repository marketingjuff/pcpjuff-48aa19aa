# SUP — importar XML de nota de industrialização (tinturaria)

Sem migração. Só dois arquivos, exatamente os da allowlist. Props do diálogo intactas.

## 1. `src/lib/nfe-xml.ts` (só acréscimos)

Nada existente é alterado. Novas funções puras:

- `cfopEhIndustrializacao(cfop)` — 3 últimos dígitos `125`.
- `cfopEhRetornoIndustrializacao(cfop)` — `925`, `926`, `924`, `901`–`907`.
- `notaEhIndustrializacao(itens)` — algum item satisfaz industrialização.
- `extrairCorItem(cProd, xProd)` — `C<dígitos>V<dígitos>` → `{ numero, nome }`;
  nome sem prefixo `Cod Prod <dígitos>` e sem `Lote=<valor>`, espaços colapsados;
  `null` quando o código não casa.
- `rotuloCor(numero, nome)` → `"20869 - AMARELO CANARIO"`.
- `agruparNotaIndustrializacao(itens)` → `{ cores, retorno, naoIdentificados }`
  com os tipos `IndCor` / `NotaIndustrializacao` do prompt. Percorre por `nItem`:
  linha de cor define a cor corrente; linha sem cor (mão de obra) entra na cor
  corrente só se `qCom` bater, senão vai para `naoIdentificados`. Consolida
  quantidade por soma e preço pelo maior `nItem`. Lote não aparece na saída.

## 2. `src/components/sup/ImportarXmlProdutosDialog.tsx`

Detecção automática pelos itens da nota; quando não é industrialização, o
componente renderiza e se comporta exatamente como hoje (nenhum caminho atual
é modificado).

Modo industrialização:

- Faixa âmbar de aviso no topo (mesmo padrão do aviso de unidade).
- Dois blocos de produto — `Tingimento` e `Mão de obra` — cada um com nome
  editável, unidade via `mapearUnidadeNFe`, e os Selects de departamento e grupo
  já existentes no arquivo.
- Uma linha por cor em cada bloco: checkbox (marcado), cor, qtd, preço editável
  em formato BR, status `novo`/`existe` (com preço atual e `%` via
  `variacaoPercentual` quando existe).
- Linha de resumo por cor: `AMARELO CANARIO — 158,40 kg — 4,4819 + 12,1181 = R$ 16,60/kg`.
- Seção recolhida cinza "Retorno de industrialização (não entra no cadastro)",
  sem checkbox.
- Aviso âmbar listando `naoIdentificados`, sem bloquear.
- Mesmo `AlertDialog` de confirmação, com resumo do que será criado/atualizado.

Leituras extras dentro do diálogo: `useSupVariacoes`, `useSupVariacaoValores` e
uma query própria em `sup_produto_variacao_precos`.

### Gravação (sequencial, por bloco marcado)

1. Variação "Cor": reaproveita a ativa com nome normalizado `cor`, senão insere;
   garante cada rótulo de cor em `sup_variacao_valores` sem duplicar (comparação
   normalizada).
2. Produto: casa por nome normalizado no fornecedor. Novo → insert com
   `preco_por_variacao: true` e `variacao_1_id`. Existente → update só de
   `preco_por_variacao`/`variacao_1_id` quando faltarem; nome, unidade,
   departamento e grupo já preenchidos não são tocados.
3. Vínculo em `sup_fornecedor_produtos`; `cod_fornecedor` só quando o código é o
   mesmo em todas as cores do produto (mão de obra), senão nulo.
4. Preço por cor sempre via `aplicarPrecoVariacaoTabela` (importado de
   `ProdutosTab`): combinação nova → insert em `sup_produto_variacao_precos` +
   preço inicial; existente com preço diferente → atualiza com `preco_anterior`;
   preço igual → nada. Motivo:
   `"Importação XML NF-e nº <numero> (industrialização)"`.
5. Toast de resumo no formato atual e `onImportado()`.

## Verificação

Typecheck e conferência dos 12 critérios de aceite, incluindo reimportação sem
duplicar e XML de compra comum inalterado.
