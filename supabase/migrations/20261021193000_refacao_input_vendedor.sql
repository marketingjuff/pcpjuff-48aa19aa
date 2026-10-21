INSERT INTO public.app_lists (kind, nome, ordem)
SELECT 'refacao_area_erro', v.nome, v.ordem
FROM (VALUES ('Input de Vendedor', 50)) AS v(nome, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_lists a
  WHERE a.kind = 'refacao_area_erro' AND a.nome = v.nome
);

INSERT INTO public.app_lists (kind, nome, ordem)
SELECT 'refacao_problema_input_vendedor', v.nome, v.ordem
FROM (VALUES ('erro de layout', 10), ('erro de quantidade', 20)) AS v(nome, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_lists a
  WHERE a.kind = 'refacao_problema_input_vendedor' AND a.nome = v.nome
);
