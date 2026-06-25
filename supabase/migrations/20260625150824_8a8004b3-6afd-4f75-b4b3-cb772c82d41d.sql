ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS historico_data_entrega jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.registrar_alteracao_data_entrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.data_entrega IS DISTINCT FROM OLD.data_entrega
     AND OLD.data_entrega IS NOT NULL THEN
    NEW.historico_data_entrega :=
      COALESCE(NEW.historico_data_entrega, '[]'::jsonb)
      || jsonb_build_object(
           'data', OLD.data_entrega,
           'em',   now(),
           'por',  auth.uid()
         );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hist_data_entrega ON public.pedidos;
CREATE TRIGGER trg_hist_data_entrega
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_alteracao_data_entrega();