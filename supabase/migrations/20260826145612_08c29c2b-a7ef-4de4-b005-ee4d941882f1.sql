ALTER TABLE public.cops
  ADD COLUMN IF NOT EXISTS quem_cortou text NULL;

INSERT INTO public.app_lists (kind, nome, ordem)
SELECT 'cop_cortador', v.nome, v.ordem
FROM (VALUES ('Bruno', 10), ('Lucas', 20)) AS v(nome, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_lists a
  WHERE a.kind = 'cop_cortador' AND a.nome = v.nome
);