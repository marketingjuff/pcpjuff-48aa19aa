ALTER TABLE public.sup_preco_historico
  ADD COLUMN IF NOT EXISTS anulado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS anulado_por uuid,
  ADD COLUMN IF NOT EXISTS anulado_em timestamptz,
  ADD COLUMN IF NOT EXISTS anulado_motivo text;

CREATE TABLE IF NOT EXISTS public.sup_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela text NOT NULL,
  registro_id uuid NOT NULL,
  identificador text,
  acao text NOT NULL CHECK (acao IN ('insert','update','delete')),
  mudancas jsonb,
  linha_completa jsonb,
  feito_por uuid,
  feito_por_email text,
  feito_por_nome text,
  feito_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sup_audit_log_registro_idx ON public.sup_audit_log(registro_id);
CREATE INDEX IF NOT EXISTS sup_audit_log_tabela_idx ON public.sup_audit_log(tabela);
CREATE INDEX IF NOT EXISTS sup_audit_log_feito_em_idx ON public.sup_audit_log(feito_em DESC);
CREATE INDEX IF NOT EXISTS sup_audit_log_feito_por_idx ON public.sup_audit_log(feito_por);

GRANT SELECT ON public.sup_audit_log TO authenticated;
GRANT ALL ON public.sup_audit_log TO service_role;

ALTER TABLE public.sup_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sup_audit_log_admin_select" ON public.sup_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER audit_sup_fornecedores
  AFTER INSERT OR UPDATE OR DELETE ON public.sup_fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('sup_audit_log', 'razao_social');

CREATE TRIGGER audit_sup_produtos
  AFTER INSERT OR UPDATE OR DELETE ON public.sup_produtos
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('sup_audit_log', 'nome');

CREATE TRIGGER audit_sup_fornecedor_produtos
  AFTER INSERT OR UPDATE OR DELETE ON public.sup_fornecedor_produtos
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('sup_audit_log', 'produto_id');

CREATE TRIGGER audit_sup_preco_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.sup_preco_historico
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('sup_audit_log', 'fornecedor_produto_id');

CREATE TRIGGER audit_sup_produto_grupos
  AFTER INSERT OR UPDATE OR DELETE ON public.sup_produto_grupos
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('sup_audit_log', 'nome');

CREATE TRIGGER audit_sup_pedidos_compra
  AFTER INSERT OR UPDATE OR DELETE ON public.sup_pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('sup_audit_log', 'numero');

CREATE TRIGGER audit_sup_pedido_itens
  AFTER INSERT OR UPDATE OR DELETE ON public.sup_pedido_itens
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('sup_audit_log', 'pedido_id');

CREATE TRIGGER audit_sup_comissoes
  AFTER INSERT OR UPDATE OR DELETE ON public.sup_comissoes
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('sup_audit_log', 'competencia');
