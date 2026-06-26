ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS pecas_solicitadas jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.sync_status_pecas_solicitadas()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  arr jsonb := COALESCE(NEW.pecas_solicitadas, '[]'::jsonb);
  total int;
  pendentes int;
BEGIN
  IF jsonb_typeof(arr) <> 'array' OR jsonb_array_length(arr) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO total FROM jsonb_array_elements(arr);
  SELECT count(*) INTO pendentes
    FROM jsonb_array_elements(arr) e
    WHERE COALESCE((e->>'qtd_enviada')::int, 0) < COALESCE((e->>'qtd')::int, 0);

  IF pendentes = 0 THEN
    NEW.status_pecas := 'completo';
  ELSE
    NEW.status_pecas := 'incompleto';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_status_pecas_solicitadas ON public.pedidos;
CREATE TRIGGER trg_sync_status_pecas_solicitadas
  BEFORE INSERT OR UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_status_pecas_solicitadas();