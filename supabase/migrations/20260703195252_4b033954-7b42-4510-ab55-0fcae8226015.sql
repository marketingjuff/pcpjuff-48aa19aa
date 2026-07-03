-- 1) app_lists.kind: adicionar novos kinds (aditivo, padrão já usado no projeto)
ALTER TABLE public.app_lists DROP CONSTRAINT IF EXISTS app_lists_kind_check;
ALTER TABLE public.app_lists ADD CONSTRAINT app_lists_kind_check CHECK (kind = ANY (ARRAY[
  'vendedor','dtf','silk','acabamento','frete','pagamento','nf',
  'status_arte','corte_dtf','revelacao_silk','motivo_perda',
  'refacao_problema_arte','refacao_problema_dtf','refacao_problema_silk','refacao_problema_acabamento',
  'refacao_area_identifica','refacao_area_erro',
  'map_fio_fornecedor','map_malharia','map_tinturaria'
]));

-- 2) map_producoes
CREATE TABLE IF NOT EXISTS public.map_producoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero int NOT NULL,
  data_pedido date NOT NULL,
  faturar_para text NOT NULL CHECK (faturar_para IN ('Joke','Juff')),
  fornecedor text NOT NULL,
  kg_solicitados numeric NOT NULL,
  nota_fiscal text,
  data_faturamento date,
  data_pagamento date,
  status text NOT NULL DEFAULT 'aguardando_faturamento'
    CHECK (status IN ('aguardando_faturamento','entregue')),
  malharia text,
  quebra_conciliada boolean NOT NULL DEFAULT false,
  quebra_conciliacao_obs text,
  quebra_conciliada_em timestamptz,
  quebra_conciliada_por uuid,
  finalizado boolean NOT NULL DEFAULT false,
  finalizado_em timestamptz,
  finalizado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_producoes TO authenticated;
GRANT ALL ON public.map_producoes TO service_role;
ALTER TABLE public.map_producoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "map_select" ON public.map_producoes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_insert" ON public.map_producoes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_update" ON public.map_producoes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_delete" ON public.map_producoes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE INDEX IF NOT EXISTS map_producoes_data_pedido_idx ON public.map_producoes (data_pedido DESC);
CREATE INDEX IF NOT EXISTS map_producoes_finalizado_idx  ON public.map_producoes (finalizado);
CREATE TRIGGER map_producoes_touch BEFORE UPDATE ON public.map_producoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) map_malharia_entregas
CREATE TABLE IF NOT EXISTS public.map_malharia_entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producao_id uuid NOT NULL REFERENCES public.map_producoes(id) ON DELETE CASCADE,
  data_recebimento date,
  kg numeric,
  pecas int,
  nota_fiscal_1 text,
  nota_fiscal_2 text,
  nota_cobertura text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_malharia_entregas TO authenticated;
GRANT ALL ON public.map_malharia_entregas TO service_role;
ALTER TABLE public.map_malharia_entregas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "map_select" ON public.map_malharia_entregas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_insert" ON public.map_malharia_entregas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_update" ON public.map_malharia_entregas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_delete" ON public.map_malharia_entregas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE INDEX IF NOT EXISTS map_malh_entregas_prod_idx ON public.map_malharia_entregas (producao_id);

-- 4) map_tinturaria_programacoes
CREATE TABLE IF NOT EXISTS public.map_tinturaria_programacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producao_id uuid NOT NULL REFERENCES public.map_producoes(id) ON DELETE CASCADE,
  tinturaria text NOT NULL,
  data_programacao date,
  pecas int,
  cor text,
  kg_enviados numeric,
  kg_recebidos numeric,
  pecas_recebidas int,
  data_recebimento date,
  nota_fiscal_recebimento text,
  nota_cobertura text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_tinturaria_programacoes TO authenticated;
GRANT ALL ON public.map_tinturaria_programacoes TO service_role;
ALTER TABLE public.map_tinturaria_programacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "map_select" ON public.map_tinturaria_programacoes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_insert" ON public.map_tinturaria_programacoes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_update" ON public.map_tinturaria_programacoes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_delete" ON public.map_tinturaria_programacoes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE INDEX IF NOT EXISTS map_tint_prog_prod_idx ON public.map_tinturaria_programacoes (producao_id);

-- 5) map_config
CREATE TABLE IF NOT EXISTS public.map_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_config TO authenticated;
GRANT ALL ON public.map_config TO service_role;
ALTER TABLE public.map_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "map_select" ON public.map_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_insert" ON public.map_config FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_update" ON public.map_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_delete" ON public.map_config FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));

INSERT INTO public.map_config (key, value) VALUES ('kg_por_peca', '20'::jsonb)
  ON CONFLICT (key) DO NOTHING;