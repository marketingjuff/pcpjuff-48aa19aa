ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS exp_destino_humberto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canhoto_horario_comercial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canhoto_impresso_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS canhoto_fotos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS entrega_confirmada_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS entrega_confirmada_por uuid NULL;

CREATE POLICY "canhotos_select_team" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'canhotos' AND public.is_team_member());

CREATE POLICY "canhotos_insert_team" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'canhotos' AND public.is_team_member());

CREATE POLICY "canhotos_update_team" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'canhotos' AND public.is_team_member());

CREATE POLICY "canhotos_delete_team" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'canhotos' AND public.is_team_member());