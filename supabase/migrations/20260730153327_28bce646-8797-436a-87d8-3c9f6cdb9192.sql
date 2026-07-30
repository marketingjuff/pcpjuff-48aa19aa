ALTER TABLE public.map_estoque_pecas
  ADD COLUMN IF NOT EXISTS devolucao_motivo text,
  ADD COLUMN IF NOT EXISTS devolucao_data date,
  ADD COLUMN IF NOT EXISTS devolucao_nf text,
  ADD COLUMN IF NOT EXISTS correcao_tipo text,
  ADD COLUMN IF NOT EXISTS correcao_status text,
  ADD COLUMN IF NOT EXISTS cor_nova text,
  ADD COLUMN IF NOT EXISTS historico_correcoes jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.app_lists DROP CONSTRAINT app_lists_kind_check;
ALTER TABLE public.app_lists ADD CONSTRAINT app_lists_kind_check CHECK ((kind = ANY (ARRAY['vendedor'::text, 'dtf'::text, 'silk'::text, 'acabamento'::text, 'frete'::text, 'pagamento'::text, 'nf'::text, 'status_arte'::text, 'corte_dtf'::text, 'revelacao_silk'::text, 'motivo_perda'::text, 'refacao_problema_arte'::text, 'refacao_problema_dtf'::text, 'refacao_problema_silk'::text, 'refacao_problema_acabamento'::text, 'refacao_area_identifica'::text, 'refacao_area_erro'::text, 'map_fio_fornecedor'::text, 'map_malharia'::text, 'map_tinturaria'::text, 'map_acabamento'::text, 'destino_perda'::text, 'map_motivo_devolucao'::text])));

INSERT INTO public.app_lists (kind, nome, ordem) VALUES
  ('map_motivo_devolucao', 'cor errada', 10),
  ('map_motivo_devolucao', 'mancha', 20),
  ('map_motivo_devolucao', 'acabamento', 30);