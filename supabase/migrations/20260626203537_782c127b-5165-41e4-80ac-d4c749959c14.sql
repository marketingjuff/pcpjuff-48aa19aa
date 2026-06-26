
ALTER TABLE public.cops
  ADD COLUMN IF NOT EXISTS oficina_id uuid NULL REFERENCES public.oficinas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_saida_oficina date NULL,
  ADD COLUMN IF NOT EXISTS data_recebimento date NULL,
  ADD COLUMN IF NOT EXISTS observacoes_romaneio text NULL,
  ADD COLUMN IF NOT EXISTS num_fretes integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pecas_recebidas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS romaneio_enviado_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS letra text NULL,
  ADD COLUMN IF NOT EXISTS cop_romaneio_pai_id uuid NULL REFERENCES public.cops(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conferido_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS conferido_por uuid NULL;

CREATE INDEX IF NOT EXISTS idx_cops_oficina_id ON public.cops(oficina_id);
CREATE INDEX IF NOT EXISTS idx_cops_romaneio_pai_id ON public.cops(cop_romaneio_pai_id);
