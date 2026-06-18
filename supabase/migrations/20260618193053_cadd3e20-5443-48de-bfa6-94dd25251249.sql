
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS dias_secagem integer,
  ADD COLUMN IF NOT EXISTS inicio_acabamento date,
  ADD COLUMN IF NOT EXISTS termino_acabamento date,
  ADD COLUMN IF NOT EXISTS n_batidas_dtf integer,
  ADD COLUMN IF NOT EXISTS n_batidas_silk integer,
  ADD COLUMN IF NOT EXISTS quem_cortou_dtf text,
  ADD COLUMN IF NOT EXISTS quem_revelou_tela text,
  ADD COLUMN IF NOT EXISTS dtf_pessoas_qtd jsonb;
