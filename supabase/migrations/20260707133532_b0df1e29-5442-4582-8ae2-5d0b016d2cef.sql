ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS correcoes_etapa jsonb NOT NULL DEFAULT '[]'::jsonb;