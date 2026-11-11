ALTER TABLE public.perdas_reclassificacoes ADD COLUMN IF NOT EXISTS area_erro_novo text;
ALTER TABLE public.perdas_reclassificacoes ADD COLUMN IF NOT EXISTS erro_producao_novo boolean;