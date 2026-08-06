# Variações de produto no SUP (Fases 1 e 2)

Produtos do SUP passam a aceitar até duas variações (ex.: Cor e Tamanho), com as listas mantidas pelo admin na aba Config. Cada produto escolhe quais listas usa e se o preço muda por combinação. Produtos sem variação continuam funcionando exatamente como hoje.

## Banco de dados (migração estritamente aditiva)

Só `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX`, `CREATE POLICY`, `CREATE TRIGGER`, `GRANT`. Nenhum `DROP`, `TRUNCATE`, `DELETE`, renomeação ou alteração de tipo. O índice `sup_fornecedor_produtos_uniq` fica intacto.

Três tabelas novas:
- `sup_variacoes` — tipos de variação (nome, ordem, ativo), nome único ignorando caixa/espaços.
- `sup_variacao_valores` — valores de cada tipo (valor, ordem, ativo), único por tipo.
- `sup_produto_variacao_precos` — preço por combinação, ligado ao vínculo fornecedor-produto, com preço de tabela, preço negociado e ativo; único por vínculo + combinação.

Colunas novas:
- `sup_produtos`: `variacao_1_id`, `variacao_2_id`, `preco_por_variacao` (default false).
- `sup_preco_historico`: `variacao_preco_id` (nulo = histórico do preço base, caso de todos os registros atuais).
- `sup_pedido_itens`: `variacao_1_nome`, `variacao_1_valor`, `variacao_2_nome`, `variacao_2_valor`, `variacao_preco_id` (ponteiro informativo, sem chave estrangeira de propósito, para o item nunca ser invalidado por mudança no catálogo).

Acesso nas três tabelas novas, no mesmo padrão de `sup_produtos`: ver/criar/editar para admin, ou gestor com acesso à área SUP; apagar só admin. Grants para `authenticated` e `service_role`, RLS ativo, trigger de `updated_at` nas três e trigger de auditoria (`sup_audit_log`) nos tipos e valores de variação.

## Fase 1 — variação descritiva

**Novo `src/components/sup/VariacoesConfig.tsx`**: dois painéis lado a lado no padrão visual dos cards do SUP. Esquerda: tipos de variação (adicionar, renomear, ativar/inativar; clicar seleciona). Direita: valores do tipo selecionado (adicionar, renomear, ativar/inativar). Nada é apagado pela interface — só inativado; valores inativos continuam visíveis em registros antigos e saem dos novos lançamentos. Duplicidade bloqueada com aviso. Exporta os hooks `useSupVariacoes()` e `useSupVariacaoValores()`.

**`SupConfigTab.tsx`**: única mudança é renderizar o novo bloco em largura total abaixo dos cards existentes.

**`ProdutosTab.tsx` — dialog de produto**: nova seção Variações abaixo de "Item equivalente (grupo)", com selects Variação 1 e Variação 2 (a segunda só habilita depois da primeira e não repete o tipo; limpar a primeira limpa a segunda) e prévia dos valores ativos em texto pequeno. Persiste no mesmo salvamento já existente. A cópia de produto para outro fornecedor passa a copiar também as variações e a flag de preço por variação (preços e histórico continuam não sendo copiados).

**`PedidoCompraDialog.tsx` — linha do item**: quando o produto tem variação, a linha ganha um select por tipo com os valores ativos. Ao salvar, grava o texto (nome do tipo + valor) como snapshot no item, nunca a chave — renomear ou inativar um valor depois não altera pedidos antigos. Valor opcional em produto de preço único, obrigatório quando o preço varia por combinação.

**`sup-pc-pdf.ts`**: na coluna Produto, sufixo `— Cor: Azul · Tamanho: M` quando houver variação. Sem coluna nova e sem mexer nos `colspan` do rodapé.

**`AlteracoesPrecoTab.tsx`**: na coluna Produto, sufixo da combinação quando o histórico tiver `variacao_preco_id`. Nada mais muda.

## Fase 2 — preço por variação

**Flag no produto**: checkbox "Preço varia conforme a variação", habilitado só com pelo menos uma variação escolhida. Ao desmarcar (estando marcado) ou ao trocar o tipo de variação de um produto que já tem preços por combinação, aparece uma confirmação avisando que as combinações passam a ficar inativas — inativa, nunca apaga, e o histórico é preservado.

**Lista de preços no dialog**: mostra apenas as combinações que já existem (compradas ou cadastradas à mão), com preço de tabela, preço negociado e edição. Sem combinações, um texto discreto explica que os preços nascem no primeiro pedido de compra. Botão "Adicionar combinação" para cadastro manual opcional, bloqueando repetição. Vírgula aceita como decimal. Combinação sem preço próprio herda o preço de tabela do vínculo.

**Duas funções novas** em `ProdutosTab.tsx`, irmãs das atuais: `aplicarPrecoVariacaoTabela` e `aplicarPrecoVariacaoNegociado`. Mesma lógica de direção (inicial/alta/baixa), status de revisão, tipo e autor das originais, com duas diferenças: o histórico inclui `variacao_preco_id` e a atualização final vai na linha da combinação, não no vínculo. `aplicarPrecoTabela` e `aplicarPrecoNegociado` ficam byte a byte como estão.

**Preço na linha do pedido**: com preço por variação e combinação escolhida, busca a linha ativa da combinação e usa o preço dela, gravando `variacao_preco_id` no item; sem linha, cai no preço base atual. Trocar o valor da variação recarrega os preços daquela linha, como já acontece ao trocar o produto.

**Sincronização pedido → catálogo**: quando o produto tem preço por variação e a combinação está escolhida, o preço digitado no pedido vai para a linha da combinação (via as funções novas) em vez do vínculo; qualquer outro caso segue o comportamento atual sem uma linha alterada. Se a combinação ainda não existe, ela é criada aqui com os preços do pedido e histórico `inicial` — é assim que o catálogo se constrói pelo uso. Depois de criar a linha, o item do pedido é atualizado com o `variacao_preco_id` recém-criado, para o vínculo não se perder justamente na compra que originou o preço. Motivo mantido: `Atualizado pelo pedido de compra {numero}`.

## Tipos e helpers (`src/lib/sup.ts`)

Somente acréscimos no fim do arquivo: tipos `SupVariacao`, `SupVariacaoValor`, `SupProdutoVariacaoPreco`; campos novos (opcionais) em `SupProduto`, `SupPrecoHistorico` e `SupPedidoItem`; helpers puros `rotuloVariacao`, `rotuloVariacaoCompleto` e `chaveVariacao`.

## Fora de escopo

Oscilação de preço, Comparativo entre fornecedores, Economia por troca, Dashboard SUP e Comissões continuam por produto/vínculo, sem alteração. Nenhuma lista nova em `app_lists` nem no catálogo de configurações. Nenhum arquivo fora da lista acima é tocado.

## Dúvidas antes de rodar a migração

1. A migração será aplicada via ferramenta de migração do Cloud (que também gera o arquivo versionado); confirma que isso atende ao pedido de criar o arquivo em `supabase/migrations/`?
2. As tabelas de variação são globais (um tipo "Cor" serve para todos os produtos e fornecedores), sem escopo por fornecedor ou departamento — confirma?
