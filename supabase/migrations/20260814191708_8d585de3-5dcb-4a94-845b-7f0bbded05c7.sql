-- Passo 1: coluna
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS arte_iniciou_em timestamptz NULL;
COMMENT ON COLUMN public.pedidos.arte_iniciou_em IS 'Momento real de entrada na Arte: primeiro save do Input de Producao (status_pecas + tipo_estampa preenchidos). Preenchido automaticamente por trigger, em horario de Brasilia. Nao aparece em telas de operacao.';

-- Passo 2: backfill (ANTES do trigger)
UPDATE public.pedidos p
   SET arte_iniciou_em = sub.feito_em
  FROM (
    SELECT l.pedido_id, MIN(l.feito_em) AS feito_em
      FROM public.pedido_audit_log l
     WHERE (
             l.acao = 'update'
             AND EXISTS (
               SELECT 1
                 FROM jsonb_array_elements(COALESCE(l.mudancas, '[]'::jsonb)) m
                WHERE m->>'campo' = 'tipo_estampa'
                  AND COALESCE(NULLIF(trim(m->>'para'), ''), NULL) IS NOT NULL
             )
           )
        OR (
             l.acao = 'insert'
             AND NULLIF(trim(COALESCE(l.linha_completa->>'tipo_estampa', '')), '') IS NOT NULL
           )
     GROUP BY l.pedido_id
  ) sub
 WHERE p.id = sub.pedido_id
   AND p.arte_iniciou_em IS NULL
   AND sub.feito_em IS NOT NULL;

-- Passo 3: funcao
CREATE OR REPLACE FUNCTION public.set_arte_iniciou_em()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.arte_iniciou_em IS NULL
     AND NULLIF(trim(COALESCE(NEW.status_pecas, '')), '') IS NOT NULL
     AND NULLIF(trim(COALESCE(NEW.tipo_estampa, '')), '') IS NOT NULL THEN
    NEW.arte_iniciou_em := timezone('America/Sao_Paulo', now());
  END IF;
  RETURN NEW;
END;
$$;

-- Passo 4: trigger
DROP TRIGGER IF EXISTS trg_arte_iniciou_em ON public.pedidos;
CREATE TRIGGER trg_arte_iniciou_em
BEFORE INSERT OR UPDATE ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.set_arte_iniciou_em();