ALTER TABLE public.sup_produtos
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.sup_fornecedores(id);

CREATE INDEX IF NOT EXISTS sup_produtos_fornecedor_idx
  ON public.sup_produtos (fornecedor_id, nome);