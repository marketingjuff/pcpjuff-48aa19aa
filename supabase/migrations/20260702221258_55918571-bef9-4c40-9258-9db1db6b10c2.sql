
ALTER TABLE public.app_lists DROP CONSTRAINT IF EXISTS app_lists_kind_check;
ALTER TABLE public.app_lists ADD CONSTRAINT app_lists_kind_check CHECK (kind IN (
  'vendedor','dtf','silk','acabamento','frete','pagamento','nf',
  'status_arte','corte_dtf','revelacao_silk','motivo_perda',
  'refacao_problema_arte','refacao_problema_dtf','refacao_problema_silk','refacao_problema_acabamento',
  'refacao_area_identifica','refacao_area_erro'
));

INSERT INTO public.app_lists (kind, nome, ordem) VALUES
  ('refacao_area_identifica','Defeito de fabricação',10),
  ('refacao_area_identifica','Arte',20),
  ('refacao_area_identifica','DTF',30),
  ('refacao_area_identifica','Silk',40),
  ('refacao_area_identifica','Acabamento',50),
  ('refacao_area_erro','Arte',10),
  ('refacao_area_erro','DTF',20),
  ('refacao_area_erro','Silk',30),
  ('refacao_area_erro','Acabamento',40)
ON CONFLICT DO NOTHING;
