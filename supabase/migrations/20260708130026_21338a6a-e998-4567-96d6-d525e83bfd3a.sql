
-- ========== MAP AUDIT LOG ==========
CREATE TABLE public.map_audit_log (
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
CREATE INDEX map_audit_log_registro_idx ON public.map_audit_log(registro_id);
CREATE INDEX map_audit_log_tabela_idx ON public.map_audit_log(tabela);
CREATE INDEX map_audit_log_feito_em_idx ON public.map_audit_log(feito_em DESC);
CREATE INDEX map_audit_log_feito_por_idx ON public.map_audit_log(feito_por);

GRANT SELECT ON public.map_audit_log TO authenticated;
GRANT ALL ON public.map_audit_log TO service_role;

ALTER TABLE public.map_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "map_audit_log_admin_select" ON public.map_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ========== COP AUDIT LOG ==========
CREATE TABLE public.cop_audit_log (
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
CREATE INDEX cop_audit_log_registro_idx ON public.cop_audit_log(registro_id);
CREATE INDEX cop_audit_log_tabela_idx ON public.cop_audit_log(tabela);
CREATE INDEX cop_audit_log_feito_em_idx ON public.cop_audit_log(feito_em DESC);
CREATE INDEX cop_audit_log_feito_por_idx ON public.cop_audit_log(feito_por);

GRANT SELECT ON public.cop_audit_log TO authenticated;
GRANT ALL ON public.cop_audit_log TO service_role;

ALTER TABLE public.cop_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cop_audit_log_admin_select" ON public.cop_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ========== FUNÇÃO GENÉRICA DE LOG ==========
-- TG_ARGV[0] = tabela de log destino ('map_audit_log' ou 'cop_audit_log')
-- TG_ARGV[1] = expressão SQL para extrair o identificador legível do registro
CREATE OR REPLACE FUNCTION public.log_generic_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _log_table text := TG_ARGV[0];
  _id_expr text := COALESCE(TG_ARGV[1], 'id');
  _uid uuid := auth.uid();
  _email text;
  _nome text;
  _mudancas jsonb := '[]'::jsonb;
  _old jsonb;
  _new jsonb;
  _key text;
  _v_old jsonb;
  _v_new jsonb;
  _identificador text;
  _registro_id uuid;
  _row jsonb;
  _tabela text := TG_TABLE_NAME;
BEGIN
  IF _uid IS NOT NULL THEN
    SELECT email, nome INTO _email, _nome FROM public.profiles WHERE id = _uid;
  END IF;

  IF TG_OP = 'DELETE' THEN
    _row := to_jsonb(OLD);
    _registro_id := (OLD).id;
  ELSE
    _row := to_jsonb(NEW);
    _registro_id := (NEW).id;
  END IF;

  -- Extrai identificador (chave do jsonb do row)
  _identificador := NULLIF(_row->>_id_expr, '');

  IF TG_OP = 'INSERT' THEN
    EXECUTE format(
      'INSERT INTO public.%I (tabela, registro_id, identificador, acao, linha_completa, feito_por, feito_por_email, feito_por_nome)
       VALUES ($1,$2,$3,''insert'',$4,$5,$6,$7)', _log_table)
      USING _tabela, _registro_id, _identificador, _row, _uid, _email, _nome;
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
    EXECUTE format(
      'INSERT INTO public.%I (tabela, registro_id, identificador, acao, mudancas, feito_por, feito_por_email, feito_por_nome)
       VALUES ($1,$2,$3,''update'',$4,$5,$6,$7)', _log_table)
      USING _tabela, _registro_id, _identificador, _mudancas, _uid, _email, _nome;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    EXECUTE format(
      'INSERT INTO public.%I (tabela, registro_id, identificador, acao, linha_completa, feito_por, feito_por_email, feito_por_nome)
       VALUES ($1,$2,$3,''delete'',$4,$5,$6,$7)', _log_table)
      USING _tabela, _registro_id, _identificador, _row, _uid, _email, _nome;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- ========== TRIGGERS MAP ==========
CREATE TRIGGER audit_map_producoes
  AFTER INSERT OR UPDATE OR DELETE ON public.map_producoes
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('map_audit_log', 'numero');

CREATE TRIGGER audit_map_tinturaria_programacoes
  AFTER INSERT OR UPDATE OR DELETE ON public.map_tinturaria_programacoes
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('map_audit_log', 'tinturaria');

CREATE TRIGGER audit_map_malharia_entregas
  AFTER INSERT OR UPDATE OR DELETE ON public.map_malharia_entregas
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('map_audit_log', 'nota_fiscal_1');

CREATE TRIGGER audit_map_estoque_pecas
  AFTER INSERT OR UPDATE OR DELETE ON public.map_estoque_pecas
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('map_audit_log', 'numero_peca');

CREATE TRIGGER audit_map_devolucoes
  AFTER INSERT OR UPDATE OR DELETE ON public.map_devolucoes
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('map_audit_log', 'nota_fiscal');

-- ========== TRIGGERS COP ==========
CREATE TRIGGER audit_cops
  AFTER INSERT OR UPDATE OR DELETE ON public.cops
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('cop_audit_log', 'numero');

CREATE TRIGGER audit_oficinas
  AFTER INSERT OR UPDATE OR DELETE ON public.oficinas
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('cop_audit_log', 'nome');

CREATE TRIGGER audit_cop_perdas
  AFTER INSERT OR UPDATE OR DELETE ON public.cop_perdas
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('cop_audit_log', 'etiqueta');

CREATE TRIGGER audit_pagamentos_consolidados
  AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos_consolidados
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_change('cop_audit_log', 'oficina_id');
