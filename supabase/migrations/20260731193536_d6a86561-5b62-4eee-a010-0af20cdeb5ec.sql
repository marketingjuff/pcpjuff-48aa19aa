-- ============ 1.1 olist_import_lotes ============
CREATE TABLE public.olist_import_lotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa text NOT NULL,
  arquivo_nome text,
  arquivos_lidos integer,
  total_linhas integer,
  total_pedidos integer,
  total_itens integer,
  importado_em timestamptz NOT NULL DEFAULT now(),
  importado_por uuid
);

GRANT SELECT, INSERT ON public.olist_import_lotes TO authenticated;
GRANT ALL ON public.olist_import_lotes TO service_role;

ALTER TABLE public.olist_import_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_olist_import_lotes" ON public.olist_import_lotes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_insert_olist_import_lotes" ON public.olist_import_lotes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============ 1.2 olist_pedidos ============
CREATE TABLE public.olist_pedidos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id uuid NOT NULL REFERENCES public.olist_import_lotes(id),
  numero_pedido text NOT NULL,
  empresa text NOT NULL,
  data date,
  data_prevista date,
  nome_contato text,
  cpf_cnpj text,
  situacao text,
  vendedor text,
  vendedor_original text,
  desconto_valor numeric,
  desconto_percentual numeric,
  desconto_original text,
  frete numeric DEFAULT 0,
  despesas numeric DEFAULT 0
);

CREATE INDEX idx_olist_pedidos_numero_pedido ON public.olist_pedidos (numero_pedido);
CREATE INDEX idx_olist_pedidos_lote_id ON public.olist_pedidos (lote_id);
CREATE INDEX idx_olist_pedidos_data ON public.olist_pedidos (data);
CREATE INDEX idx_olist_pedidos_empresa ON public.olist_pedidos (empresa);

GRANT SELECT, INSERT ON public.olist_pedidos TO authenticated;
GRANT ALL ON public.olist_pedidos TO service_role;

ALTER TABLE public.olist_pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_olist_pedidos" ON public.olist_pedidos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_insert_olist_pedidos" ON public.olist_pedidos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============ 1.3 olist_itens ============
CREATE TABLE public.olist_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id uuid NOT NULL REFERENCES public.olist_import_lotes(id),
  numero_pedido text NOT NULL,
  descricao_original text NOT NULL,
  produto_olist text,
  cor text,
  tamanho text,
  qtd integer NOT NULL DEFAULT 0,
  valor_unitario numeric NOT NULL DEFAULT 0,
  desconto_item numeric DEFAULT 0,
  is_servico boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_olist_itens_numero_pedido ON public.olist_itens (numero_pedido);
CREATE INDEX idx_olist_itens_lote_id ON public.olist_itens (lote_id);
CREATE INDEX idx_olist_itens_produto_olist ON public.olist_itens (produto_olist);

GRANT SELECT, INSERT ON public.olist_itens TO authenticated;
GRANT ALL ON public.olist_itens TO service_role;

ALTER TABLE public.olist_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_olist_itens" ON public.olist_itens
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_insert_olist_itens" ON public.olist_itens
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============ 1.4 olist_pedidos_excluidos ============
CREATE TABLE public.olist_pedidos_excluidos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_pedido text NOT NULL UNIQUE,
  motivo text,
  excluido_em timestamptz NOT NULL DEFAULT now(),
  excluido_por uuid
);

GRANT SELECT, INSERT, DELETE ON public.olist_pedidos_excluidos TO authenticated;
GRANT ALL ON public.olist_pedidos_excluidos TO service_role;

ALTER TABLE public.olist_pedidos_excluidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_olist_pedidos_excluidos" ON public.olist_pedidos_excluidos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_insert_olist_pedidos_excluidos" ON public.olist_pedidos_excluidos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_delete_olist_pedidos_excluidos" ON public.olist_pedidos_excluidos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));