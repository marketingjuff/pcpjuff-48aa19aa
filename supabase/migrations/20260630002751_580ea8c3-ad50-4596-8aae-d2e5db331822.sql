-- 1) Remover unicidade simples de numero
ALTER TABLE public.cops DROP CONSTRAINT IF EXISTS cops_numero_key;

-- 2) Unicidade composta (numero, letra) tratando NULL como ''
CREATE UNIQUE INDEX IF NOT EXISTS cops_numero_letra_uidx
  ON public.cops (numero, (COALESCE(letra, '')));

-- 3) Reatribuir numero dos filhos de partição já existentes para o do pai-origem
UPDATE public.cops f
SET numero = p.numero
FROM public.cops p
WHERE f.cop_romaneio_pai_id IS NOT NULL
  AND p.id = f.cop_romaneio_pai_id
  AND f.numero <> p.numero;

-- 4) Reposicionar o sequence
SELECT setval('public.cops_numero_seq', (SELECT COALESCE(MAX(numero), 0) FROM public.cops));
