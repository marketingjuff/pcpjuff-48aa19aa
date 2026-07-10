ALTER TABLE public.cops
  ADD COLUMN IF NOT EXISTS refacao_perda_origem_id uuid REFERENCES public.cops(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refacao_perda_itens jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_cops_refacao_perda_origem_id ON public.cops(refacao_perda_origem_id);