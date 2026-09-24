-- Anulação reversível de lote de importação Olist. Nada é apagado.

ALTER TABLE public.olist_import_lotes
  ADD COLUMN IF NOT EXISTS anulado_em timestamptz,
  ADD COLUMN IF NOT EXISTS anulado_por uuid,
  ADD COLUMN IF NOT EXISTS anulado_motivo text;

CREATE INDEX IF NOT EXISTS idx_olist_import_lotes_anulado_em
  ON public.olist_import_lotes (anulado_em);

-- GRANT restrito a estas três colunas. Totais, datas e empresa do lote
-- permanecem imutáveis mesmo para admin.
GRANT UPDATE (anulado_em, anulado_por, anulado_motivo)
  ON public.olist_import_lotes TO authenticated;

CREATE POLICY "admin_update_anulacao_olist_import_lotes"
  ON public.olist_import_lotes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));