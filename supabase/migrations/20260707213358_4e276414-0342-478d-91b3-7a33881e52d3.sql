
-- 1) Tabela de auditoria
CREATE TABLE public.pedido_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL,
  orcamento text,
  pedido_olist text,
  acao text NOT NULL CHECK (acao IN ('insert','update','delete')),
  mudancas jsonb,
  linha_completa jsonb,
  feito_por uuid,
  feito_por_email text,
  feito_por_nome text,
  feito_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pedido_audit_log_pedido_id ON public.pedido_audit_log(pedido_id);
CREATE INDEX idx_pedido_audit_log_pedido_olist ON public.pedido_audit_log(pedido_olist);
CREATE INDEX idx_pedido_audit_log_feito_em ON public.pedido_audit_log(feito_em DESC);

-- 2) Grants — só leitura via API; trigger escreve com SECURITY DEFINER
GRANT SELECT ON public.pedido_audit_log TO authenticated;
GRANT ALL ON public.pedido_audit_log TO service_role;

-- 3) RLS
ALTER TABLE public.pedido_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_team_members"
  ON public.pedido_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_team_member());

-- 4) Função de log
CREATE OR REPLACE FUNCTION public.log_pedido_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _nome text;
  _mudancas jsonb := '[]'::jsonb;
  _old jsonb;
  _new jsonb;
  _key text;
  _v_old jsonb;
  _v_new jsonb;
BEGIN
  IF _uid IS NOT NULL THEN
    SELECT email, nome INTO _email, _nome FROM public.profiles WHERE id = _uid;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.pedido_audit_log (pedido_id, orcamento, pedido_olist, acao, linha_completa, feito_por, feito_por_email, feito_por_nome)
    VALUES (NEW.id, NEW.orcamento, NEW.pedido_olist, 'insert', to_jsonb(NEW), _uid, _email, _nome);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    FOR _key IN SELECT jsonb_object_keys(_new) LOOP
      IF _key IN ('updated_at') THEN CONTINUE; END IF;
      _v_old := _old->_key;
      _v_new := _new->_key;
      IF _v_old IS DISTINCT FROM _v_new THEN
        _mudancas := _mudancas || jsonb_build_object('campo', _key, 'de', _v_old, 'para', _v_new);
      END IF;
    END LOOP;
    IF jsonb_array_length(_mudancas) = 0 THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.pedido_audit_log (pedido_id, orcamento, pedido_olist, acao, mudancas, feito_por, feito_por_email, feito_por_nome)
    VALUES (NEW.id, NEW.orcamento, NEW.pedido_olist, 'update', _mudancas, _uid, _email, _nome);
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.pedido_audit_log (pedido_id, orcamento, pedido_olist, acao, linha_completa, feito_por, feito_por_email, feito_por_nome)
    VALUES (OLD.id, OLD.orcamento, OLD.pedido_olist, 'delete', to_jsonb(OLD), _uid, _email, _nome);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_pedido_change() FROM PUBLIC, anon, authenticated;

-- 5) Trigger
DROP TRIGGER IF EXISTS trg_audit_pedidos ON public.pedidos;
CREATE TRIGGER trg_audit_pedidos
  AFTER INSERT OR UPDATE OR DELETE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.log_pedido_change();
