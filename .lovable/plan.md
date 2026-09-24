# Anular importação Olist (reversível, sem apagar nada)

Uma importação feita por engano pode ser marcada como "Anulada". Ela passa a ser ignorada em todos os cálculos, mas nenhuma linha sai do banco. Reativar devolve tudo como era, com um clique.

## Estado atual conferido
- `olist_import_lotes` tem só as policies `admin_insert_...` e `admin_select_...`. A policy `admin_update_anulacao_olist_import_lotes` ainda não existe, então não há conflito.
- As colunas `anulado_*` ainda não existem.
- `useIsAdmin` existe em `@/hooks/use-role`.

## Arquivos (somente a allowlist)

### 1. Nova migração em `supabase/migrations/`
O SQL entra exatamente como está no pedido:
- `ADD COLUMN IF NOT EXISTS` para `anulado_em`, `anulado_por` e `anulado_motivo`
- `CREATE INDEX IF NOT EXISTS idx_olist_import_lotes_anulado_em`
- `GRANT UPDATE (anulado_em, anulado_por, anulado_motivo) ... TO authenticated`
- `CREATE POLICY "admin_update_anulacao_olist_import_lotes"`, com USING e WITH CHECK restritos a admin

Não entra nenhum DROP, DELETE, TRUNCATE, ALTER COLUMN, grant de DELETE ou policy de DELETE.

### 2. `src/components/kpi/ImportacaoOlistTab.tsx`
- **Lote:** a interface ganha os campos `anulado_em`, `anulado_por` e `anulado_motivo`.
- **Aviso de troca de empresa:** a query `empresaPorPedido` busca antes os ids dos lotes anulados e pula as linhas desses lotes na hora de montar o mapa.
- **Histórico:** ganha a coluna "Ações", e a linha vazia passa a usar `colSpan` 8. Só admin vê os botões, via `useIsAdmin`.
  - Lote ativo: botão "Anular" (outline, sm, ícone `Ban`).
  - Lote anulado: badge "Anulado" (destructive) ao lado da data, com o motivo no `title`. A linha fica com `opacity-55`, o nome do arquivo fica riscado e o botão vira "Reativar" (ícone `RotateCcw`).
- **Diálogo "Anular esta importação?":** usa `AlertDialog` e mostra empresa, data e hora, arquivo, total de pedidos e total de itens do lote. Traz o texto fixo do pedido, um `Textarea` "Motivo (opcional)" e o botão destrutivo "Anular importação".
- **Diálogo "Reativar esta importação?":** traz o texto fixo do pedido e o botão "Reativar".
- **Mutations `anularLote` e `reativarLote`:** usam o update do pedido e seguem o mesmo padrão de `gravar`.
  - Em caso de sucesso: mostram um toast, fecham o diálogo, limpam o motivo e invalidam `["olist-vendas"]` e `["indicadores-olist"]`.
  - Em caso de erro: `toast.error` com a mensagem, nunca em silêncio.

### 3. `src/components/kpi/IndicadoresTab.tsx`
- O select de lotes passa a trazer também `anulado_em`.
- O mapa `lotes` fica só com os lotes ativos, e um `Set` `lotesAnulados` guarda os anulados.
- Pedidos e itens dos lotes anulados são filtrados antes de chamar `apenasVigentes`, que continua sem mudança. O código é o mesmo "Depois" do pedido.

### 4. `src/components/cop/PendenciaMapeamentoAlert.tsx`
- O select de lotes passa a trazer também `anulado_em`.
- O loop de lotes começa com `if (l.anulado_em) continue;`.

## Arquivos protegidos
Ficam sem nenhuma mudança: `cop-saldos.ts`, `olist-vendas.ts`, `indicadores-olist.ts`, `admin.functions.ts`, `schema-extras.ts`, `AlimentacaoEstoqueTab.tsx` e `package.json`.

## Verificação
- Rodar o typecheck.
- Mostrar o diff completo dos 4 arquivos.
- Contar as linhas de `olist_pedidos` e `olist_itens`, que devem continuar com o mesmo número.
