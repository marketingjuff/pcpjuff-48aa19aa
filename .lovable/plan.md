# Vincular o item do pedido à combinação de variação criada na hora

## Problema

Ao salvar um pedido de compra, os itens são gravados antes do bloco que
sincroniza os preços com o catálogo. Quando a combinação de variação
(cor/tamanho) ainda não existe no cadastro do fornecedor, ela é criada nesse
bloco posterior — e o item do pedido fica sem referência a ela.

## O que muda

Somente dentro do caminho de produto com preço por variação, no ponto em que
uma nova combinação é criada: logo após criá-la, o item correspondente do
pedido passa a apontar para essa combinação.

Nada mais é alterado: o caminho de produto sem variação, a aplicação de preço
de tabela e de preço negociado continuam exatamente como estão.

## Detalhes técnicos

Arquivo único: `src/components/sup/PedidoCompraDialog.tsx`, dentro do
`for (const l of linhas)` final da mutation `salvar`.

Trocar o `for (const l of linhas)` por uma forma com índice (ou manter o
objeto da linha, que já traz `l.id`) e, imediatamente após o
`insert` em `sup_produto_variacao_precos` que define `comb`:

```ts
const upd = (supabase as any)
  .from("sup_pedido_itens")
  .update({ variacao_preco_id: comb!.id });
const { error: eU } = l.id
  ? await upd.eq("id", l.id)
  : await upd
      .eq("pedido_id", id)
      .eq("produto_id", l.produto_id)
      .eq("variacao_1_valor", l.variacao_1_valor)
      .filter(
        "variacao_2_valor",
        l.variacao_2_valor ? "eq" : "is",
        l.variacao_2_valor ?? null,
      );
if (eU) throw eU;
```

Também atualizar `l.variacao_preco_id` em memória, para que o estado local do
diálogo fique coerente sem precisar recarregar.
