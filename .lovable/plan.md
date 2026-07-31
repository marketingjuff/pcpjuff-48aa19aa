# FASE 3 — De-para de produtos e aviso de pendência (revisado 2)

Objetivo: tirar o cadastro `produto_olist → modelo` de dentro da tela de importação de estoque, deixá-lo nas configurações do COP restrito a administrador, e criar um aviso permanente de produtos sem correspondência.

## Migração (único item de banco desta fase)

Duas políticas **RESTRITIVAS** em `olist_produto_map`, sem apagar nem alterar as políticas atuais:

- `INSERT` restritivo: `WITH CHECK (has_role(auth.uid(), 'admin'))`
- `UPDATE` restritivo: `USING` + `WITH CHECK` com a mesma condição

Resultado efetivo: `(admin OU gestor) E (admin)` = **admin**.

Nada de restritiva em `SELECT` (o gestor precisa ler para o Saldo Real e para o aviso) nem em `DELETE` — não existe política de DELETE nem botão de excluir hoje.

**Nada além disso no banco.** Sem view, sem função, sem RPC.

## Hooks compartilhados — não mover

`useProdutoMap` e `useItensUltimoSnapshot` continuam **exportados de `AlimentacaoEstoqueTab.tsx`**, exatamente como estão. `SaldoRealTab.tsx` já importa de lá e esse import não muda. O `ProdutoMapCard` importa `useProdutoMap` desse mesmo arquivo — não recria, não duplica, não move.

## Arquivos

CRIAR
- `src/components/cop/ProdutoMapCard.tsx` — cadastro do de-para, no padrão dos outros cards de configuração
- `src/components/cop/PendenciaMapeamentoAlert.tsx` — aviso reutilizável de produtos sem correspondência

ALTERAR
- `src/components/cop/CopConfigPanel.tsx` — inclui o `ProdutoMapCard` na sequência de cards existente
- `src/components/cop/AlimentacaoEstoqueTab.tsx` — remove o card "Produtos pendentes de mapeamento" e o código que só ele usava; exibe o aviso no topo
- `src/components/pcp/ImportacaoOlistTab.tsx` — exibe o aviso no topo

## Remoção cirúrgica em AlimentacaoEstoqueTab.tsx

Delimitação do JSX: o `Card` a remover começa logo depois do `</div>` que fecha o grid de cartões de empresa e termina no `</Card>` imediatamente antes de `{ignoradasUltimas.length > 0 && (`. Nada fora desse intervalo sai.

Sai junto (código que fica órfão):
- `pendenteSel` / `setPendenteSel`
- `salvarMap` (mutation) — migra para o `ProdutoMapCard`
- `pendentes` (useMemo)
- `pendentesInfo`
- `pendentesSort`
- `mapaOrdenado`
- `mapaSort`

**Fica, obrigatoriamente:**
- `useProdutoMap` — exportado; `SaldoRealTab` importa
- `mapa` — usado pelo toast pós-importação
- `mapPorProduto` — parece do bloco do de-para, mas é usado no cálculo de `novosPendentes` dentro da mutação de importar; removê-lo quebra a importação de estoque

Toda a lógica de importação, leitura de planilha, snapshots, cartões de empresa e o card de linhas ignoradas permanecem intactos.

## ProdutoMapCard

- Admin: interface completa, com seletor de modelo e gravação (a mutation `salvarMap` vem para cá).
- Gestor: mesma lista em **somente leitura** — sem campos, sem seletor, sem botão de salvar — com aviso de que o cadastro é privativo de administrador. O gestor já acessa Configurações, então o card aparece para ele nesse modo.
- Checagem de tela com `useIsAdmin()`; a RLS é a garantia real.

## PendenciaMapeamentoAlert

Pendência pelo **estado atual**, separada por origem:

- **Estoque** — produtos do último snapshot (`useItensUltimoSnapshot`) ausentes de `olist_produto_map`. Visível para todos.
- **Vendas** — produtos de `olist_itens` ausentes do de-para. `olist_itens` é restrita a admin, então essa consulta e essa linha aparecem **apenas para admin**; o gestor não vê essa parte nem um total que a inclua.

Consulta de vendas: `select("produto_olist")` filtrando pelo `lote_id` mais recente de cada empresa, e deduplicação em JavaScript com `Set`. Uma coluna de texto curto, poucas centenas de linhas — barato. Sem `DISTINCT`/`GROUP BY` (o PostgREST não oferece), sem view, sem função, sem paginar tabela inteira.

Texto nomeia a origem explicitamente — "3 produtos do estoque", "2 produtos das vendas" — nunca um total anônimo, para que admin e gestor não vejam números divergentes sem explicação.

`Alert` com `variant="destructive"`: contagem por origem, aviso de que esses produtos ficam fora do Saldo Real e dos indicadores até a validação, orientação de acionar um administrador e a lista dos produtos. Aparece quando houver pendência e desaparece sozinho quando não houver. Não bloqueia nada. Para admin, botão levando às configurações do COP.

## Cuidados

- O `toast` atual de produtos sem mapeamento continua; o aviso complementa, não substitui.
- Nenhum outro arquivo é tocado; nada de refatoração adjacente.
