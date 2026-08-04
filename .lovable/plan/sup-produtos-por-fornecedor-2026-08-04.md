# SUP — produtos por fornecedor

Cada produto passa a pertencer a um fornecedor. Acaba o catálogo global e a tela de "vincular fornecedor".

## Banco (só aditivo)
Uma migração nova, exatamente:
- `ALTER TABLE public.sup_produtos ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.sup_fornecedores(id);`
- `CREATE INDEX IF NOT EXISTS sup_produtos_fornecedor_idx ON public.sup_produtos (fornecedor_id, nome);`

Coluna nullable de propósito. Nenhuma policy nova, nenhuma tabela/coluna alterada ou removida.

## src/lib/sup.ts
Só adiciona `fornecedor_id: string | null` ao type `SupProduto`. Nenhum cálculo alterado.

## Aba Produtos (ProdutosTab.tsx)
- Coluna esquerda: lista de fornecedores com busca, "Mostrar inativos" e contagem de produtos ativos; seleção com destaque teal.
- Coluna direita: produtos do fornecedor selecionado, com busca e tabela ordenável (Produto, Categoria, Unidade, Preço de tabela, Qtd. mínima, Prazo, Situação, editar). Mensagens de estado vazio conforme o spec.
- "Novo produto" desabilitado sem fornecedor selecionado.
- Abaixo: histórico de preço do produto clicado (sem a coluna Fornecedor), mesmas cores e ícones.
- Removidos: bloco "Preços por fornecedor", seletor de vincular fornecedor e o dialog separado de preço.
- Dialog único de produto com fornecedor fixo no título e os campos do spec (preço, qtd. mínima, prazo, motivo e anexo só na edição quando o preço muda).
- Gravação na ordem definida: produto → vínculo 1:1 em `sup_fornecedor_produtos` (sempre) → `aplicarPrecoTabela` só se houver preço/mudança de preço.
- Validação de nome duplicado dentro do mesmo fornecedor.
- Botão "Copiar para outro fornecedor": cria produto + vínculo no destino, sem preço nem histórico.
- `useSupProdutos`, `useSupFornecedorProdutos` e `aplicarPrecoTabela` mantêm nome, assinatura e formato de retorno.

## Pedido de Compra (PedidoCompraDialog.tsx)
- Seletor de produto passa a listar apenas produtos ativos do fornecedor escolhido; desabilitado sem fornecedor; aviso quando o fornecedor não tem produtos.
- Trocar fornecedor com itens já lançados abre confirmação; confirmar limpa as linhas, cancelar mantém tudo.
- Cálculo de preço, economia, comissão, desconto, frete e status inalterados.

## Fora de escopo
Nenhum outro arquivo é tocado — em especial `cop-saldos.ts`, demais libs, outras abas do SUP, PCP/COP/MAP/KPI, rotas e o PDF do pedido.
