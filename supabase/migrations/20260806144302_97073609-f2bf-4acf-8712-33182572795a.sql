ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS necessita_captacao_video boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_captado_silk boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_captado_dtf boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.pcp_capacidade_etapa (
  etapa text PRIMARY KEY,
  teto_dia integer NOT NULL DEFAULT 0,
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE ON public.pcp_capacidade_etapa TO authenticated;
GRANT ALL ON public.pcp_capacidade_etapa TO service_role;

ALTER TABLE public.pcp_capacidade_etapa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capacidade_select_authenticated"
  ON public.pcp_capacidade_etapa FOR SELECT TO authenticated USING (true);

CREATE POLICY "capacidade_insert_admin"
  ON public.pcp_capacidade_etapa FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "capacidade_update_admin"
  ON public.pcp_capacidade_etapa FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.pcp_capacidade_etapa (etapa, teto_dia) VALUES
  ('arte', 900),
  ('dtf', 700),
  ('silk', 900),
  ('acabamento', 900)
ON CONFLICT (etapa) DO NOTHING;