# De-para da Olist: paginação, busca nas duas listas e exclusão

## 1. src/components/cop/PendenciaMapeamentoAlert.tsx (só a consulta a olist_itens em useProdutosVendas)
Troca a consulta única por um laço de 1000 em 1000, com `.order("id")` (`olist_itens.id` é uuid único, então a ordem é estável) e `.range(...)`. A agregação passa a usar `linhas`. Nada mais muda.

## 2. src/components/cop/ProdutoMapCard.tsx
- Helper `semAcento` e um filtro por palavras: todas as palavras precisam aparecer, em qualquer ordem, sem diferenciar acento nem maiúscula.
- Estados `buscaPend` e `buscaMapa`, independentes. Cada lista ganha um Input (`h-8 w-[260px] text-xs`) alinhado à direita do seu título. Para isso a lista de pendentes passa a ter um título curto.
- Filtro aplicado antes de `useTableSort` nas duas listas. O badge e o alerta vermelho continuam mostrando o total real de pendentes.
- Título "Já mapeados (N)" vira "Já mapeados (X de N)" quando há busca.
- Busca sem resultado: uma linha "Nenhum produto encontrado para essa busca."
- Coluna de lixeira em "Já mapeados", só para admin. A confirmação usa AlertDialog com o texto do pedido. A nova mutation `excluirMap` apaga por id e invalida as mesmas duas listas que `salvarMap`. `salvarMap` e o formulário Adicionar ficam intactos.

## 3. Banco
Migração aditiva com o SQL exato do pedido: `GRANT DELETE` e uma policy de DELETE só para admin. Ela é aplicada pela ferramenta de migração do projeto, que grava o arquivo em drizzle/migrations/. Uma cópia idêntica fica em supabase/migrations/. Nenhuma policy existente é alterada.

## Ao final
Typecheck e diff em /mnt/documents/diff-de-para-olist.diff.
