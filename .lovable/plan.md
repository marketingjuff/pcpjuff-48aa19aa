# SUP — preço negociado, grupos de equivalência e comparativo de fornecedores

Três entregas: preço negociado no cadastro do produto (com histórico próprio), grupo de equivalência para comparar o mesmo item entre fornecedores, e dois blocos novos de comparação na aba Alterações de Preço.

## Migração (nova, estritamente aditiva)
- `sup_fornecedor_produtos`: `ADD COLUMN preco_negociado numeric NULL`.
- `sup_preco_historico`: `ADD COLUMN tipo text NOT NULL DEFAULT 'tabela'` (linhas antigas continuam "tabela").
- Nova tabela `sup_produto_grupos` (nome, categoria, unidade_referencia, ativo, created_by, created_at), índice único em `lower(nome)`, RLS ligada e 4 policies (select/insert/update para admin ou gestor com área sup; delete só admin), com os GRANTs necessários.
- `sup_produtos`: `ADD COLUMN grupo_id uuid REFERENCES sup_produto_grupos(id)` e `fator_conversao numeric DEFAULT 1`, índice em `grupo_id`.
- Nenhum DROP/TRUNCATE/DELETE/RENAME; nenhuma policy existente tocada.

## src/lib/sup.ts (só adições)
- Type novo `SupProdutoGrupo`; campos novos em `SupProduto` (`grupo_id`, `fator_conversao`), `SupFornecedorProduto` (`preco_negociado`) e `SupPrecoHistorico` (`tipo`).
- Funções puras novas: `precoPorUnidadeRef`, `precoVigente`, `variacaoPreco`.
- `economiaItem`, `subtotalItem`, `subtotalNegociado`, `descontoGlobalRs`, `calcTotaisPedido`, `statusPorRecebimento`, `variacaoPercentual` e a fórmula de comissão ficam intactas.

## ProdutosTab.tsx
- Hook novo `useSupProdutoGrupos()`; `useSupProdutos` e `useSupFornecedorProdutos` mantêm assinatura e retorno.
- Função nova `aplicarPrecoNegociado` (espelho de `aplicarPrecoTabela`, que não é alterada): grava histórico com `tipo: "negociado"` e `status_revisao: "revisada"` sempre, e atualiza `preco_negociado` do vínculo.
- Dialog de produto ganha: Preço negociado (ao lado do preço de tabela), Item equivalente (grupo, com busca e "+ Criar novo grupo" em sub-dialog com nome/unidade de referência/categoria e bloqueio de nome duplicado) e Fator de conversão (default 1, só com grupo, rejeita ≤ 0, com texto de ajuda do rolo/metro).
- Esvaziar o preço negociado grava `null` no vínculo e uma linha de histórico `negociado` com valor 0 e motivo "Preço negociado removido". O preço de tabela nunca muda por causa do negociado.
- Preço convertido em texto pequeno (`≈ R$ 0,12 / metro`) quando há grupo e fator > 0.
- "Copiar para outro fornecedor" leva `grupo_id` e `fator_conversao` (preço continua em branco).
- Tabela do fornecedor com colunas novas Grupo, Preço negociado, Dif. % (verde quando negativo, vermelho quando positivo) e R$/un. ref, mantendo `SortTh`/`useTableSort`.
- Histórico do produto ganha coluna Tipo com badge e filtro Todos/Tabela/Negociado; "Revisada"/"Contestar" não aparecem em linhas negociadas.

## PedidoCompraDialog.tsx
- Ao escolher o produto, `preco_tabela` recebe o preço de tabela e `preco_negociado` recebe o negociado do cadastro quando houver, senão o de tabela. Ambos seguem editáveis.
- Quando vier negociado do cadastro, aviso pequeno em teal "preço negociado do cadastro" abaixo do campo.
- `preco_historico_id` continua apontando para o histórico do preço de tabela. Nada mais muda no arquivo — nenhuma trava automática de comissão.

## AlteracoesPrecoTab.tsx
- Bloco A (atual) ganha coluna Tipo e filtro de tipo; ações de revisão ocultas em linhas negociadas.
- Bloco B "Comparativo entre fornecedores": seletor de grupo com busca (só grupos ativos com produto vinculado) e tabela por produto do grupo com Fornecedor, Produto, Un. compra, Fator, Preço tabela, Preço negociado, R$/un. ref, Última compra, R$/un. ref na última compra e vs. melhor — menor valor destacado em verde, demais em `+X,X%` vermelho; inativos com badge. Rodapé com o melhor preço de hoje.
- Bloco C "Economia por troca de fornecedor": relatório de referência (aviso em tela de que não entra na apuração de comissão), baseado em itens de pedidos não cancelados no período De/Até com produto agrupado, comparando com a última compra do mesmo grupo em fornecedor diferente. Encarecimento aparece negativo em vermelho. Rodapé com totais e botão "Exportar CSV" (separador `;`, decimal com vírgula, cabeçalho em português).
- `useSupPedidos`/`useSupPedidoItens` são apenas importados de `PedidosCompraTab.tsx`, sem alterá-lo.

## Fora de escopo
Nenhum outro arquivo é tocado: `cop-saldos.ts`, `ComissoesTab.tsx`, `DashboardSupTab.tsx`, `PedidosCompraTab.tsx`, `FornecedoresTab.tsx`, `DepartamentosTab.tsx`, `SupConfigTab.tsx`, `SupConfigPanel.tsx` e todos os módulos PCP, COP, MAP e KPI.

## Validação
Build completo ao final, confirmando ausência de erros de TypeScript.
