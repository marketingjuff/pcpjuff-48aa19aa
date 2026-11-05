CREATE TABLE IF NOT EXISTS public.plan_pausas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo text NOT NULL,
  cor text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('adiado', 'sob_demanda')),
  ate date NULL,
  observacao text NULL,
  criado_em timestamptz NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  criado_por uuid NULL DEFAULT auth.uid(),
  retomado_em timestamptz NULL,
  retomado_por uuid NULL
);

CREATE INDEX IF NOT EXISTS plan_pausas_ativas_idx
  ON public.plan_pausas (modelo, cor)
  WHERE retomado_em IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.plan_pausas TO authenticated;
GRANT ALL ON public.plan_pausas TO service_role;

ALTER TABLE public.plan_pausas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_pausas_select_team" ON public.plan_pausas
  FOR SELECT TO authenticated
  USING (public.is_team_member());

CREATE POLICY "plan_pausas_insert_team" ON public.plan_pausas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_team_member());

CREATE POLICY "plan_pausas_update_team" ON public.plan_pausas
  FOR UPDATE TO authenticated
  USING (public.is_team_member())
  WITH CHECK (public.is_team_member());