ALTER TABLE public.app_lists DROP CONSTRAINT IF EXISTS app_lists_kind_check;
ALTER TABLE public.app_lists ADD CONSTRAINT app_lists_kind_check CHECK (kind = ANY (ARRAY[
  'vendedor','dtf','silk','acabamento','frete','pagamento','nf',
  'status_arte','corte_dtf','revelacao_silk','motivo_perda',
  'refacao_problema_arte','refacao_problema_dtf','refacao_problema_silk','refacao_problema_acabamento',
  'refacao_area_identifica','refacao_area_erro',
  'map_fio_fornecedor','map_malharia','map_tinturaria',
  'map_acabamento'
]));

INSERT INTO public.app_lists (kind, nome, ordem)
SELECT v.kind, v.nome, v.ordem
FROM (VALUES
  ('map_acabamento','ACAB1',10),
  ('map_acabamento','ACAB2',20),
  ('map_acabamento','ACAB3',30),
  ('map_acabamento','ACAB4',40)
) AS v(kind, nome, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_lists a WHERE a.kind = v.kind AND a.nome = v.nome
);

INSERT INTO public.map_config (key, value) VALUES ('cor_acabamentos', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;