
ALTER TABLE public.app_lists DROP CONSTRAINT IF EXISTS app_lists_kind_check;
ALTER TABLE public.app_lists ADD CONSTRAINT app_lists_kind_check
  CHECK (kind = ANY (ARRAY['vendedor','dtf','silk','acabamento','frete','pagamento','nf','status_arte','corte_dtf','revelacao_silk','motivo_perda']));

INSERT INTO public.app_lists (kind, nome, ordem)
  SELECT 'motivo_perda', v, ord
  FROM (VALUES ('Defeito do tecido', 10), ('Tecido desfiado', 20), ('Erro de costura', 30)) AS x(v, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.app_lists WHERE kind='motivo_perda' AND nome=x.v
  );
