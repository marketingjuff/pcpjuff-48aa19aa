ALTER TABLE public.cop_perdas ADD COLUMN IF NOT EXISTS area_identificou text;
ALTER TABLE public.cop_perdas ADD COLUMN IF NOT EXISTS erro_producao boolean;
ALTER TABLE public.cop_perdas ADD COLUMN IF NOT EXISTS area_erro text;
ALTER TABLE public.cop_perdas ADD COLUMN IF NOT EXISTS problema text;