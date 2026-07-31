# FASE 3 — De-para de produtos e aviso de pendência

Objetivo: tirar o cadastro `produto_olist → modelo` de dentro da tela de importação de estoque, deixá-lo nas configurações do COP restrito a administrador, e criar um aviso permanente de produtos sem correspondência.

## Migração (único item de banco desta fase)

Duas políticas **RESTRITIVAS** em `olist_produto_map`, sem apagar nem alterar as políticas atuais (admin ou gestor continuam intactas):

- `INSERT` restritivo: `WITH CHECK (has_role(auth.uid(), 'admin'))`
- `UPDATE` restritivo: `USING` + `WITH CHECK` com a mesma condição

Resultado efetivo: `(admin OU gestor) E (admin)` = **admin**.

Nada de política restritiva em `SELECT` nem em `DELETE` — o gestor precisa continuar lendo a tabela, senão o Saldo Real do COP e o próprio aviso de pendência param de funcionar.

## Arquivos

CRIAR
- `src/components/cop/ProdutoMapCard.tsx` — cadastro do de-para, no mesmo padrão dos outros cards de configuração
- `src/components/cop/PendenciaMapeamentoAlert.tsx` — aviso reutilizável de produtos sem correspondência

ALTERAR
- `src/components/cop/CopConfigPanel.tsx` — inclui o `ProdutoMapCard` na sequência de cards existente
- `src/components/cop/AlimentacaoEstoqueTab.tsx` — remove **apenas** a seção de cadastro do de-para e passa a exibir o aviso no topo
- `src/components/pcp/ImportacaoOlistTab.tsx` — exibe o aviso no topo

## ProdutoMapCard

- Admin: interface completa, com seletor de modelo e gravação.
- Gestor: mesma lista em **somente leitura** — sem campos, sem seletor, sem botão de salvar — com aviso de que o cadastro é privativo de administrador.
- A checagem de tela usa `useIsAdmin()` de `@/hooks/use-role`; a RLS é a garantia real.

## PendenciaMapeamentoAlert

- Calcula a pendência pelo **estado atual**: produtos presentes em `estoque_olist_itens` ou `olist_itens` que não constam em `olist_produto_map` — não a partir do evento de importação.
- `Alert` com `variant="destructive"`, mostrando a contagem, o texto de que esses produtos ficam fora do Saldo Real e dos indicadores até a validação, a orientação de acionar um administrador e a lista dos produtos.
- Aparece sempre que a tela carrega e desaparece só quando não houver mais pendência. Não bloqueia nada.
- Para admin, botão adicional levando às configurações do COP.

## Cuidados

- Em `AlimentacaoEstoqueTab.tsx`, toda a lógica de importação de estoque, leitura de planilha, snapshots e cálculo permanece intacta — sai apenas a interface de cadastro.
- O `toast` atual de produtos sem mapeamento continua; o aviso complementa, não substitui.
- Nenhum outro arquivo é tocado; nada de refatoração adjacente.
