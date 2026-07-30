CREATE TABLE public.estoque_olist_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa text NOT NULL CHECK (empresa IN ('JOKE','JUFF')),
  arquivo_nome text,
  importado_em timestamp with time zone NOT NULL DEFAULT now(),
  importado_por uuid,
  total_linhas integer NOT NULL DEFAULT 0,
  linhas_ignoradas jsonb NOT NULL DEFAULT '[]'::jsonb
);

GRANT SELECT, INSERT, UPDATE ON public.estoque_olist_snapshots TO authenticated;
GRANT ALL ON public.estoque_olist_snapshots TO service_role;
ALTER TABLE public.estoque_olist_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e gestor podem ver snapshots" ON public.estoque_olist_snapshots
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role));
CREATE POLICY "Admin e gestor podem importar snapshots" ON public.estoque_olist_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role));

CREATE TABLE public.estoque_olist_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_id uuid NOT NULL REFERENCES public.estoque_olist_snapshots(id) ON DELETE CASCADE,
  empresa text NOT NULL CHECK (empresa IN ('JOKE','JUFF')),
  produto_olist text NOT NULL,
  cor text NOT NULL,
  tamanho text NOT NULL,
  qtd integer NOT NULL DEFAULT 0
);

CREATE INDEX estoque_olist_itens_snapshot_idx ON public.estoque_olist_itens (snapshot_id);

GRANT SELECT, INSERT ON public.estoque_olist_itens TO authenticated;
GRANT ALL ON public.estoque_olist_itens TO service_role;
ALTER TABLE public.estoque_olist_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e gestor podem ver itens" ON public.estoque_olist_itens
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role));
CREATE POLICY "Admin e gestor podem inserir itens" ON public.estoque_olist_itens
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role));

CREATE TABLE public.olist_produto_map (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_olist text NOT NULL UNIQUE,
  modelo_cop text NOT NULL,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  criado_por uuid
);

GRANT SELECT, INSERT, UPDATE ON public.olist_produto_map TO authenticated;
GRANT ALL ON public.olist_produto_map TO service_role;
ALTER TABLE public.olist_produto_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e gestor podem ver mapeamento" ON public.olist_produto_map
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role));
CREATE POLICY "Admin e gestor podem criar mapeamento" ON public.olist_produto_map
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role));
CREATE POLICY "Admin e gestor podem editar mapeamento" ON public.olist_produto_map
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role));