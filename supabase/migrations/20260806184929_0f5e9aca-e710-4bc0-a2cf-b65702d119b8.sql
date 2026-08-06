ALTER TABLE public.app_lists DROP CONSTRAINT IF EXISTS app_lists_kind_check;

INSERT INTO public.app_lists (kind, nome, ordem)
SELECT 'sup_unidade', v.nome, v.ordem
FROM (VALUES ('unidade',10),('peça',20),('kg',30),('litro',40),('metro',50),('rolo',60),('caixa',70),('pacote',80)) AS v(nome, ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.app_lists a WHERE a.kind = 'sup_unidade' AND a.nome = v.nome);