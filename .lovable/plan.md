# FASE 3 — De-para de produtos e aviso de pendência (revisado)

Objetivo: tirar o cadastro `produto_olist → modelo` de dentro da tela de importação de estoque, deixá-lo nas configurações do COP restrito a administrador, e criar um aviso permanente de produtos sem correspondência.

## Migração (único item de banco desta fase)

Duas políticas **RESTRITIVAS** em `olist_produto_map`, sem apagar nem alterar as políticas atuais:

- `INSERT` restritivo: `WITH CHECK (has_role(auth.uid(), 'admin'))`
- `UPDATE` restritivo: `USING` + `WITH CHECK` com a mesma condição

Resultado efetivo: `(admin OU gestor) E (admin)` = **admin**.

Nada de restritiva em `SELECT` (o gestor precisa ler para o Saldo Real e para o aviso) nem em `DELETE` — não existe política de DELETE nem botão de excluir hoje.

## Hooks compartilhados — não mover

`useProdutoMap` e `useItensUltimoSnapshot` continuam **exportados de `AlimentacaoEstoqueTab.tsx`**, exatamente como estão. `SaldoRealTab.tsx` já importa de lá e esse import não muda. O `ProdutoMapCard` importa `useProdutoMap` desse mesmo arquivo — não recria, não duplica, não move para arquivo compartilhado.

## Arquivos

CRIAR
- `src/components/cop/ProdutoMapCard.tsx` — cadastro do de-para, no padrão dos outros cards de configuração
- `src/components/cop/PendenciaMapeamentoAlert.tsx` — aviso reutilizável de produtos sem correspondência

ALTERAR
- `src/components/cop/CopConfigPanel.tsx` — inclui o `ProdutoMapCard` na sequência de cards existente
- `src/components/cop/AlimentacaoEstoqueTab.tsx` — remove **somente** o segundo `Card`, "Produtos pendentes de mapeamento" (a partir da linha ~337), e passa a exibir o aviso no topo. Os cartões de empresa e o de linhas ignoradas ficam; os hooks exportados ficam; toda a lógica de importação fica
- `src/components/pcp/ImportacaoOlistTab.tsx` — exibe o aviso no topo

## ProdutoMapCard

- Admin: interface completa, com seletor de modelo e gravação.
- Gestor: mesma lista em **somente leitura** — sem campos, sem seletor, sem botão de salvar — com aviso de que o cadastro é privativo de administrador. O gestor já acessa Configurações, então o card aparece para ele nesse modo.
- Checagem de tela com `useIsAdmin()` de `@/hooks/use-role`; a RLS é a garantia real.

## PendenciaMapeamentoAlert

Calcula a pendência pelo **estado atual**, e separa por origem:

- **Estoque** — produtos de `estoque_olist_itens` (último snapshot, via `useItensUltimoSnapshot`) ausentes de `olist_produto_map`. Visível para todos.
- **Vendas** — produtos de `olist_itens` ausentes do de-para. `olist_itens` é restrita a admin, então essa parte é consultada e exibida **apenas quando o usuário é admin**; o gestor não vê essa linha nem um total que a inclua.

O texto nomeia a origem explicitamente — "3 produtos do estoque", "2 produtos das vendas" — nunca um total anônimo, justamente para que admin e gestor não vejam números divergentes sem explicação.

Consulta de vendas por desempenho: buscar apenas os **valores distintos** de `produto_olist` (agrupamento no banco, limitado aos lotes mais recentes), não as linhas inteiras. Sem paginação de tabela cheia só para contar produto.

`Alert` com `variant="destructive"`: contagem por origem, aviso de que esses produtos ficam fora do Saldo Real e dos indicadores até a validação, orientação de acionar um administrador e a lista dos produtos. Aparece sempre que houver pendência e desaparece sozinho quando não houver. Não bloqueia nada. Para admin, botão levando às configurações do COP.

## Cuidados

- O `toast` atual de produtos sem mapeamento continua; o aviso complementa, não substitui.
- Nenhum outro arquivo é tocado; nada de refatoração adjacente.
