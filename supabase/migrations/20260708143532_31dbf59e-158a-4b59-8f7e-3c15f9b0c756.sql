
-- Sequência para NE (Número do Estoque)
CREATE SEQUENCE IF NOT EXISTS public.map_estoque_pecas_ne_seq;

ALTER TABLE public.map_estoque_pecas
  ADD COLUMN IF NOT EXISTS ne integer;

-- Preenche NE para linhas existentes na ordem de entrada
DO $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.map_estoque_pecas
    WHERE ne IS NULL
    ORDER BY data_entrada NULLS LAST, created_at
  LOOP
    n := n + 1;
    UPDATE public.map_estoque_pecas SET ne = n WHERE id = r.id;
  END LOOP;
  -- Alinha a sequência ao maior NE atual
  PERFORM setval('public.map_estoque_pecas_ne_seq', GREATEST(n, 1), true);
END $$;

-- Default nextval para novas inserções
ALTER TABLE public.map_estoque_pecas
  ALTER COLUMN ne SET DEFAULT nextval('public.map_estoque_pecas_ne_seq');

ALTER SEQUENCE public.map_estoque_pecas_ne_seq OWNED BY public.map_estoque_pecas.ne;

CREATE UNIQUE INDEX IF NOT EXISTS map_estoque_pecas_ne_key
  ON public.map_estoque_pecas (ne);
