# SUP — corrigir modo industrialização: cada cor vira produto próprio

Sem migração, sem apagar nada em `sup_variacoes` / `sup_variacao_valores`. Só os dois
arquivos da allowlist; props do diálogo intactas.

## 1. `src/lib/nfe-xml.ts` (só um acréscimo)

- Mantidos como estão: `cfopEhIndustrializacao`, `cfopEhRetornoIndustrializacao`,
  `notaEhIndustrializacao`, `extrairCorItem`, `agruparNotaIndustrializacao`, tipo `IndCor`.
- `rotuloCor` permanece, passando a servir apenas para exibição.
- Novo: `numeroCorDeCodigo(cod)` — de `C20869V2587` devolve `"20869"`, senão `null`.

## 2. `src/components/sup/ImportarXmlProdutosDialog.tsx`

Modo compra comum: nenhuma alteração de comportamento.

### Modelo em memória

- Remover `IndBloco`, `montarBlocos`, `atualizarBloco`, `atualizarIndLinha` e todo uso de
  `sup_variacoes`, `sup_variacao_valores`, `sup_produto_variacao_precos`,
  `useSupVariacaoPrecos` e `aplicarPrecoVariacaoTabela`.
- Novo estado: lista plana `IndProduto[]` — duas linhas por cor (tingimento e mão de obra):
  `{ marcado, nome, codFornecedor, numeroCor, tipo, qtd, unidade, departamento, grupo, preco }`.
  Nome inicial `Tingimento <COR> <número>` / `Mão de obra <COR> <número>`, unidade via
  `mapearUnidadeNFe`, preço em formato BR editável.

### Tela

- Faixa âmbar de aviso no topo (mantida) e seção cinza recolhida com os itens de retorno
  (CFOP 5925), sem checkbox.
- Tabela única no estilo visual do modo normal, uma linha por produto proposto:
  checkbox marcado por padrão · nome editável · cód. fornecedor · qtd · unidade ·
  departamento · grupo · preço editável · status `novo`/`existe` (com preço atual e `%`
  por `variacaoPercentual`).
- Seletores de preenchimento em massa (unidade, departamento, grupo) reaproveitados.
- Linha de resumo por cor, só leitura:
  `AMARELO CANARIO — 158,40 kg — 4,4819 + 12,1181 = R$ 16,60/kg`.
- Aviso âmbar dos itens não identificados, sem bloquear.

### Gravação (uma linha por vez)

1. Tingimento: casa com produto do fornecedor cujo `cod_fornecedor` tenha o mesmo número
   de cor (`numeroCorDeCodigo`); se o código mudou, atualiza `cod_fornecedor`. Sem
   correspondência por código, procura por `normalizarNome` do nome proposto; senão cria.
2. Mão de obra: casa só por `normalizarNome`; senão cria.
3. Produtos criados com `preco_por_variacao: false` e `variacao_1_id: null`. Em produto
   existente, nome/unidade/departamento/grupo já preenchidos nunca são sobrescritos.
4. Vínculo em `sup_fornecedor_produtos` com `cod_fornecedor` da linha.
5. Preço sempre via `aplicarPrecoTabela` (já existente, alimenta histórico). Preço igual →
   nada; diferente → grava com `preco_anterior` atual e motivo
   `"Importação XML NF-e nº <numero> (industrialização)"`.

### Erros visíveis

- Falhas acumuladas em estado e exibidas em caixa vermelha dentro do diálogo (produto +
  mensagem), que permanece até o usuário fechar.
- Diálogo não fecha se houve qualquer falha; se nada gravou, mostra
  `Nenhum produto foi cadastrado.` acima da lista de erros.

## Verificação

Typecheck e conferência dos 14 critérios de aceite, incluindo reimportação sem duplicar,
troca de versão do código da cor e XML de compra comum inalterado.
