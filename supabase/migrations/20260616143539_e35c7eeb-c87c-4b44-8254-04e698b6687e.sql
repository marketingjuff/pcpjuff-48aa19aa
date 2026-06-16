
ALTER TABLE public.app_lists DROP CONSTRAINT app_lists_kind_check;
ALTER TABLE public.app_lists ADD CONSTRAINT app_lists_kind_check
  CHECK (kind = ANY (ARRAY['vendedor','dtf','silk','acabamento','frete','pagamento','nf','status_arte']));

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS dtf_cortado text,
  ADD COLUMN IF NOT EXISTS dtf_cortado_data date,
  ADD COLUMN IF NOT EXISTS vetorizacao_dtf text,
  ADD COLUMN IF NOT EXISTS vetorizacao_silk text;

INSERT INTO public.app_lists (kind, nome, ordem) VALUES
  ('status_arte', 'Imprimindo', 10),
  ('status_arte', 'Aprovar Amostra', 20),
  ('status_arte', 'Arte Finalizada', 30)
ON CONFLICT (kind, nome) DO NOTHING;

UPDATE public.pedidos
SET vetorizacao_silk = CASE WHEN vetorizacao_executada THEN 'Sim' ELSE 'Não' END
WHERE necessita_vetorizacao = true
  AND vetorizacao_executada IS NOT NULL
  AND tipo_estampa IN ('Silk','DTF+Silk')
  AND vetorizacao_silk IS NULL;

UPDATE public.pedidos
SET vetorizacao_dtf = CASE WHEN vetorizacao_executada THEN 'Sim' ELSE 'Não' END
WHERE necessita_vetorizacao = true
  AND vetorizacao_executada IS NOT NULL
  AND tipo_estampa = 'DTF'
  AND vetorizacao_dtf IS NULL;
