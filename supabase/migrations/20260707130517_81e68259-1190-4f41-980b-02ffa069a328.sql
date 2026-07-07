CREATE TABLE IF NOT EXISTS public.map_devolucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producao_id uuid NOT NULL REFERENCES public.map_producoes(id),
  nota_fiscal text NOT NULL,
  cor text NOT NULL,
  pecas numeric NOT NULL,
  kg numeric NOT NULL,
  faturado_para text NOT NULL,
  data_devolucao date NOT NULL DEFAULT current_date,
  obs text,
  status text NOT NULL DEFAULT 'em_andamento',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  finalizada_em timestamptz,
  finalizada_por uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_devolucoes TO authenticated;
GRANT ALL ON public.map_devolucoes TO service_role;

ALTER TABLE public.map_devolucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "map_select" ON public.map_devolucoes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_insert" ON public.map_devolucoes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_update" ON public.map_devolucoes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_delete" ON public.map_devolucoes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));

CREATE INDEX IF NOT EXISTS map_devolucoes_prod_idx   ON public.map_devolucoes (producao_id);
CREATE INDEX IF NOT EXISTS map_devolucoes_status_idx ON public.map_devolucoes (status);