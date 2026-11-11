INSERT INTO public.app_lists (kind, nome, ordem) VALUES
  ('refacao_area_erro_externa', 'Tecido', 10),
  ('refacao_area_erro_externa', 'Costura', 20)
ON CONFLICT (kind, nome) DO NOTHING;

INSERT INTO public.app_lists (kind, nome, ordem)
SELECT 'refacao_problema_area:' || a.id, v.nome, v.ordem
FROM public.app_lists a
CROSS JOIN (VALUES
  ('Barramento', 10),
  ('Mancha de tingimento', 20),
  ('Tecido desfiado', 30),
  ('Defeito do tecido', 40),
  ('Emenda', 50)
) AS v(nome, ordem)
WHERE a.kind = 'refacao_area_erro_externa' AND a.nome = 'Tecido'
ON CONFLICT (kind, nome) DO NOTHING;

INSERT INTO public.app_lists (kind, nome, ordem)
SELECT 'refacao_problema_area:' || a.id, v.nome, v.ordem
FROM public.app_lists a
CROSS JOIN (VALUES
  ('Pique', 10),
  ('Peça descosturada', 20),
  ('Volta para conserto', 30)
) AS v(nome, ordem)
WHERE a.kind = 'refacao_area_erro_externa' AND a.nome = 'Costura'
ON CONFLICT (kind, nome) DO NOTHING;

INSERT INTO public.app_lists (kind, nome, ordem) VALUES
  ('refacao_problema_area:f0fcc076-1529-4e75-a5d8-61733fbd80bf', 'Erro de corte', 10),
  ('refacao_problema_area:f0fcc076-1529-4e75-a5d8-61733fbd80bf', 'Peça estampada indevidamente', 20)
ON CONFLICT (kind, nome) DO NOTHING;