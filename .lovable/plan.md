
# Pagamento Consolidado por Oficina (COP)

Implementação aditiva no módulo COP, aba Pagamentos. Não altera fluxo individual existente, não toca em PCP nem em `src/lib/cop-saldos.ts`.

## 1. Migração SQL (aditiva)

- `CREATE TABLE IF NOT EXISTS public.pagamentos_consolidados` (id, oficina_id FK, detalhes jsonb, valor_total numeric, observacao, pago_por, pago_em, created_at).
- `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` + `GRANT ALL TO service_role` na nova tabela (regra de grants em `public`).
- `ENABLE ROW LEVEL SECURITY` + policy `SELECT` para admin ou gestor com área COP. Sem policy de INSERT/UPDATE/DELETE (escrita só via RPC SECURITY DEFINER).
- `ALTER TABLE public.cops ADD COLUMN IF NOT EXISTS pagamento_consolidado_id uuid`.
- `CREATE OR REPLACE FUNCTION public.pagar_consolidado_oficina(_oficina_id uuid, _cop_ids uuid[], _observacao text) RETURNS uuid` (SECURITY DEFINER):
  - Rejeita se caller não é admin.
  - Valida que todos os COP ids pertencem à oficina e estão `pagamento_status = 'liberado'`.
  - Monta snapshot `detalhes` com `pagamento_valor_calculado` e soma.
  - Insere linha em `pagamentos_consolidados`.
  - `UPDATE cops SET pagamento_status='pago', pagamento_pago_em=now(), pagamento_pago_por=auth.uid(), pagamento_consolidado_id=_novo_id, status='Finalizado'`.
  - `REVOKE ... FROM public; GRANT EXECUTE TO authenticated`.
- Nenhum DROP / TRUNCATE / DELETE. Não altera `liberar_pagamento_cop` nem `marcar_pagamento_cop`.

## 2. Tipos (`src/lib/cop.ts`, aditivo)

- Adicionar `pagamento_consolidado_id: string | null` ao tipo `Cop`.
- Adicionar tipo `PagamentoConsolidado` refletindo a nova tabela.

## 3. Novos componentes

### `src/components/cop/PagamentoConsolidadoCard.tsx` (somente admin)
- Query dos COPs `pagamento_status = 'liberado'` agrupados por oficina.
- Select de oficinas com contagem e soma: `OFICINA X (3 liberados · R$ 1.250,00)`.
- Lista de COPs liberados dessa oficina: checkbox (pré-marcados), `rotuloCop`, data de liberação (pt-BR), badge "Atrasado" reusando `isPagamentoAtrasado` (extraída de `PagamentoOficinasTab.tsx` para um util compartilhado, sem alterar comportamento), valor = `pagamento_valor_calculado`.
- Total dinâmico em `fmtMoney`.
- Textarea observação (uppercase).
- Botão "Pagar selecionados (Admin)" → AlertDialog de confirmação listando COPs e total → chama RPC `pagar_consolidado_oficina`.
- Toast + `invalidateQueries(["cops"])` e histórico consolidado.

### `src/components/cop/HistoricoPagamentosConsolidados.tsx` (admin + gestor COP)
- Query últimos 50 `pagamentos_consolidados` ordem `pago_em desc`, com botão "Carregar mais".
- Tabela: Data · Oficina · Qtd COPs · Valor total · Observação · Pago por (nome via `useProfilesMap`).
- Linhas expansíveis mostrando `detalhes` (rótulo + valor por COP).

## 4. Alteração mínima em `PagamentoOficinasTab.tsx`

- Importar e renderizar `PagamentoConsolidadoCard` (topo) e `HistoricoPagamentosConsolidados` (rodapé).
- Se necessário, exportar `isPagamentoAtrasado` do arquivo para reuso — sem mudar sua lógica.
- Nenhuma outra alteração no fluxo individual.

## Detalhes técnicos

- Guarda de admin: `useIsAdmin()` de `src/hooks/use-role.ts`.
- Cliente Supabase: `@/integrations/supabase/client`.
- Chamada RPC: `supabase.rpc('pagar_consolidado_oficina', { _oficina_id, _cop_ids, _observacao })`.
- Nomes de usuários: reutilizar `useProfilesMap` (já usado no projeto).
- Sem mudanças em `cop-saldos.ts`, RLS existentes, ou fluxo Liberar/Marcar/Editar/Apagar.

## Critérios de aceite

- Admin seleciona oficina com N liberados, desmarca alguns, confirma → selecionados viram Pago/Finalizado, desmarcados permanecem Liberados.
- Registro criado em `pagamentos_consolidados` aparece no histórico expansível.
- Gestor COP vê histórico, não vê card de pagamento.
- Fluxo individual intacto.
- Migração 100% aditiva.
