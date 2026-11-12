ALTER TABLE public.oficinas ADD COLUMN IF NOT EXISTS codigo integer;
CREATE UNIQUE INDEX IF NOT EXISTS oficinas_codigo_unico
  ON public.oficinas (codigo) WHERE codigo IS NOT NULL;
ALTER TABLE public.pcp_capacidade_etapa ADD COLUMN IF NOT EXISTS qtd_bercos integer;
ALTER TABLE public.cop_perdas ADD COLUMN IF NOT EXISTS berco text;