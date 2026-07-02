
ALTER TABLE public.app_lists DROP CONSTRAINT IF EXISTS app_lists_kind_check;
ALTER TABLE public.app_lists ADD CONSTRAINT app_lists_kind_check CHECK (kind IN (
  'vendedor','dtf','silk','acabamento','frete','pagamento','nf','status_arte','corte_dtf','revelacao_silk','motivo_perda',
  'refacao_problema_arte','refacao_problema_dtf','refacao_problema_silk','refacao_problema_acabamento'
));
