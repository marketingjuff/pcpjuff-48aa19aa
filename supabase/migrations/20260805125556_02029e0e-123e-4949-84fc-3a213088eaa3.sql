ALTER TABLE public.sup_fornecedor_produtos
  ADD COLUMN IF NOT EXISTS preco_negociado numeric NULL;

ALTER TABLE public.sup_preco_historico
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'tabela';

CREATE TABLE IF NOT EXISTS public.sup_produto_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text,
  unidade_referencia text NOT NULL DEFAULT 'unidade',
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_produto_grupos TO authenticated;
GRANT ALL ON public.sup_produto_grupos TO service_role;

ALTER TABLE public.sup_produtos
  ADD COLUMN IF NOT EXISTS grupo_id uuid REFERENCES public.sup_produto_grupos(id),
  ADD COLUMN IF NOT EXISTS fator_conversao numeric DEFAULT 1;

CREATE INDEX IF NOT EXISTS sup_produtos_grupo_idx
  ON public.sup_produtos (grupo_id);

CREATE UNIQUE INDEX IF NOT EXISTS sup_produto_grupos_nome_uidx
  ON public.sup_produto_grupos (lower(nome));

ALTER TABLE public.sup_produto_grupos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sup_grupos_select" ON public.sup_produto_grupos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));

CREATE POLICY "sup_grupos_insert" ON public.sup_produto_grupos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));

CREATE POLICY "sup_grupos_update" ON public.sup_produto_grupos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')))
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));

CREATE POLICY "sup_grupos_delete" ON public.sup_produto_grupos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role));