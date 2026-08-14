ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS refacoes_desfeitas jsonb NOT NULL DEFAULT '[]'::jsonb;