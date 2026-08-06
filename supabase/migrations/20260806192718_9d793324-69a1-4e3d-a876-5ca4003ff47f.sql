-- ============ Tipos de variação ============
CREATE TABLE public.sup_variacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 50,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sup_variacoes_nome_uniq ON public.sup_variacoes (lower(btrim(nome)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_variacoes TO authenticated;
GRANT ALL ON public.sup_variacoes TO service_role;
ALTER TABLE public.sup_variacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sup_variacoes_select" ON public.sup_variacoes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role)
    OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_variacoes_insert" ON public.sup_variacoes FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role)
    OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_variacoes_update" ON public.sup_variacoes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role)
    OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')))
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role)
    OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_variacoes_delete" ON public.sup_variacoes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TRIGGER trg_sup_variacoes_updated_at BEFORE UPDATE ON public.sup_variacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER audit_sup_variacoes AFTER INSERT OR UPDATE OR DELETE ON public.sup_variacoes
FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('sup_audit_log', 'nome');

-- ============ Valores de variação ============
CREATE TABLE public.sup_variacao_valores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variacao_id uuid NOT NULL REFERENCES public.sup_variacoes(id),
  valor text NOT NULL,
  ordem integer NOT NULL DEFAULT 50,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sup_variacao_valores_uniq
  ON public.sup_variacao_valores (variacao_id, lower(btrim(valor)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_variacao_valores TO authenticated;
GRANT ALL ON public.sup_variacao_valores TO service_role;
ALTER TABLE public.sup_variacao_valores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sup_variacao_valores_select" ON public.sup_variacao_valores FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role)
    OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_variacao_valores_insert" ON public.sup_variacao_valores FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role)
    OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_variacao_valores_update" ON public.sup_variacao_valores FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role)
    OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')))
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role)
    OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_variacao_valores_delete" ON public.sup_variacao_valores FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TRIGGER trg_sup_variacao_valores_updated_at BEFORE UPDATE ON public.sup_variacao_valores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER audit_sup_variacao_valores AFTER INSERT OR UPDATE OR DELETE ON public.sup_variacao_valores
FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('sup_audit_log', 'valor');

-- ============ Preço por combinação ============
CREATE TABLE public.sup_produto_variacao_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_produto_id uuid NOT NULL REFERENCES public.sup_fornecedor_produtos(id),
  variacao_1_valor text,
  variacao_2_valor text,
  preco_tabela numeric(14,4),
  preco_negociado numeric(14,4),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sup_produto_variacao_precos_uniq
  ON public.sup_produto_variacao_precos
  (fornecedor_produto_id, COALESCE(variacao_1_valor,''), COALESCE(variacao_2_valor,''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_produto_variacao_precos TO authenticated;
GRANT ALL ON public.sup_produto_variacao_precos TO service_role;
ALTER TABLE public.sup_produto_variacao_precos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sup_produto_variacao_precos_select" ON public.sup_produto_variacao_precos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role)
    OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_produto_variacao_precos_insert" ON public.sup_produto_variacao_precos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role)
    OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_produto_variacao_precos_update" ON public.sup_produto_variacao_precos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role)
    OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')))
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role)
    OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_produto_variacao_precos_delete" ON public.sup_produto_variacao_precos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TRIGGER trg_sup_produto_variacao_precos_updated_at BEFORE UPDATE ON public.sup_produto_variacao_precos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Colunas novas ============
ALTER TABLE public.sup_produtos
  ADD COLUMN variacao_1_id uuid REFERENCES public.sup_variacoes(id),
  ADD COLUMN variacao_2_id uuid REFERENCES public.sup_variacoes(id),
  ADD COLUMN preco_por_variacao boolean NOT NULL DEFAULT false;

ALTER TABLE public.sup_preco_historico
  ADD COLUMN variacao_preco_id uuid REFERENCES public.sup_produto_variacao_precos(id);

ALTER TABLE public.sup_pedido_itens
  ADD COLUMN variacao_1_nome text,
  ADD COLUMN variacao_1_valor text,
  ADD COLUMN variacao_2_nome text,
  ADD COLUMN variacao_2_valor text,
  ADD COLUMN variacao_preco_id uuid;