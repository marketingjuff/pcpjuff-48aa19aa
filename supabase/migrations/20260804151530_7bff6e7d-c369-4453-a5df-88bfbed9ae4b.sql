-- ============ SUP (Suprimentos) ============

CREATE TABLE public.sup_fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  nome_fantasia text,
  documento text,
  categoria text,
  contato_nome text,
  contato_telefone text,
  contato_email text,
  cidade text,
  uf text,
  condicao_pagamento_padrao text,
  prazo_entrega_padrao_dias integer,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_fornecedores TO authenticated;
GRANT ALL ON public.sup_fornecedores TO service_role;
ALTER TABLE public.sup_fornecedores ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sup_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text,
  unidade text NOT NULL DEFAULT 'unidade',
  especificacao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_produtos TO authenticated;
GRANT ALL ON public.sup_produtos TO service_role;
ALTER TABLE public.sup_produtos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sup_fornecedor_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL REFERENCES public.sup_fornecedores(id),
  produto_id uuid NOT NULL REFERENCES public.sup_produtos(id),
  preco_tabela numeric(14,4),
  quantidade_minima numeric(14,3),
  prazo_entrega_dias integer,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sup_fornecedor_produtos_uniq ON public.sup_fornecedor_produtos (fornecedor_id, produto_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_fornecedor_produtos TO authenticated;
GRANT ALL ON public.sup_fornecedor_produtos TO service_role;
ALTER TABLE public.sup_fornecedor_produtos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sup_preco_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_produto_id uuid NOT NULL REFERENCES public.sup_fornecedor_produtos(id),
  preco_anterior numeric(14,4),
  preco_novo numeric(14,4) NOT NULL,
  direcao text NOT NULL,
  motivo text,
  anexo_url text,
  status_revisao text NOT NULL DEFAULT 'pendente',
  revisado_por uuid,
  revisado_em timestamptz,
  alterado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sup_preco_historico_fp_idx ON public.sup_preco_historico (fornecedor_produto_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_preco_historico TO authenticated;
GRANT ALL ON public.sup_preco_historico TO service_role;
ALTER TABLE public.sup_preco_historico ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sup_pedidos_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,
  empresa text NOT NULL DEFAULT 'juff',
  fornecedor_id uuid NOT NULL REFERENCES public.sup_fornecedores(id),
  data_pedido date NOT NULL DEFAULT current_date,
  responsavel_id uuid,
  comissionado_id uuid,
  comissao_percentual numeric(6,3),
  status text NOT NULL DEFAULT 'rascunho',
  condicao_pagamento text,
  condicao_pagamento_outros text,
  previsao_entrega date,
  data_recebimento_total date,
  data_pagamento date,
  frete_valor numeric(14,2) NOT NULL DEFAULT 0,
  desconto_global_tipo text,
  desconto_global_valor numeric(14,4) NOT NULL DEFAULT 0,
  nota_fiscal_numero text,
  observacoes text,
  cancelado_em timestamptz,
  cancelado_motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_pedidos_compra TO authenticated;
GRANT ALL ON public.sup_pedidos_compra TO service_role;
ALTER TABLE public.sup_pedidos_compra ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sup_pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.sup_pedidos_compra(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.sup_produtos(id),
  quantidade numeric(14,3) NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'unidade',
  preco_tabela numeric(14,4) NOT NULL DEFAULT 0,
  preco_negociado numeric(14,4) NOT NULL DEFAULT 0,
  preco_historico_id uuid REFERENCES public.sup_preco_historico(id),
  quantidade_recebida numeric(14,3) NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sup_pedido_itens_pedido_idx ON public.sup_pedido_itens (pedido_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_pedido_itens TO authenticated;
GRANT ALL ON public.sup_pedido_itens TO service_role;
ALTER TABLE public.sup_pedido_itens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sup_pedido_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.sup_pedidos_compra(id) ON DELETE CASCADE,
  url text NOT NULL,
  nome_arquivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX sup_pedido_anexos_pedido_idx ON public.sup_pedido_anexos (pedido_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_pedido_anexos TO authenticated;
GRANT ALL ON public.sup_pedido_anexos TO service_role;
ALTER TABLE public.sup_pedido_anexos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sup_comissionados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  nome text NOT NULL,
  percentual numeric(6,3) NOT NULL DEFAULT 5,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_comissionados TO authenticated;
GRANT ALL ON public.sup_comissionados TO service_role;
ALTER TABLE public.sup_comissionados ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sup_pedidos_compra
  ADD CONSTRAINT sup_pedidos_compra_comissionado_fk
  FOREIGN KEY (comissionado_id) REFERENCES public.sup_comissionados(id);

CREATE TABLE public.sup_comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia text NOT NULL,
  comissionado_id uuid NOT NULL REFERENCES public.sup_comissionados(id),
  economia_total numeric(14,2) NOT NULL DEFAULT 0,
  percentual_aplicado numeric(6,3) NOT NULL DEFAULT 0,
  valor_comissao numeric(14,2) NOT NULL DEFAULT 0,
  ajuste_valor numeric(14,2) NOT NULL DEFAULT 0,
  ajuste_motivo text,
  status text NOT NULL DEFAULT 'a_apurar',
  liberado_por uuid,
  liberado_em timestamptz,
  pago_por uuid,
  pago_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sup_comissoes_uniq ON public.sup_comissoes (competencia, comissionado_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_comissoes TO authenticated;
GRANT ALL ON public.sup_comissoes TO service_role;
ALTER TABLE public.sup_comissoes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sup_comissao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comissao_id uuid NOT NULL REFERENCES public.sup_comissoes(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES public.sup_pedidos_compra(id),
  economia numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sup_comissao_itens_comissao_idx ON public.sup_comissao_itens (comissao_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_comissao_itens TO authenticated;
GRANT ALL ON public.sup_comissao_itens TO service_role;
ALTER TABLE public.sup_comissao_itens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sup_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  percentual_padrao numeric(6,3) NOT NULL DEFAULT 5,
  dias_carencia_recebimento integer NOT NULL DEFAULT 15,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_config TO authenticated;
GRANT ALL ON public.sup_config TO service_role;
ALTER TABLE public.sup_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.sup_config (percentual_padrao, dias_carencia_recebimento) VALUES (5, 15);

CREATE TABLE public.sup_numeracao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_mes text NOT NULL UNIQUE,
  ultimo_numero integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.sup_numeracao TO authenticated;
GRANT ALL ON public.sup_numeracao TO service_role;
ALTER TABLE public.sup_numeracao ENABLE ROW LEVEL SECURITY;

-- ============ Políticas ============

-- Leitura: admin ou gestor com área sup
CREATE POLICY "sup_fornecedores_select" ON public.sup_fornecedores FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_fornecedores_insert" ON public.sup_fornecedores FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_fornecedores_update" ON public.sup_fornecedores FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')))
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_fornecedores_delete" ON public.sup_fornecedores FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "sup_produtos_select" ON public.sup_produtos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_produtos_insert" ON public.sup_produtos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_produtos_update" ON public.sup_produtos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')))
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_produtos_delete" ON public.sup_produtos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "sup_fp_select" ON public.sup_fornecedor_produtos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_fp_insert" ON public.sup_fornecedor_produtos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_fp_update" ON public.sup_fornecedor_produtos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')))
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_fp_delete" ON public.sup_fornecedor_produtos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role));

-- Histórico de preço: append-only para gestor; admin pode revisar
CREATE POLICY "sup_hist_select" ON public.sup_preco_historico FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_hist_insert" ON public.sup_preco_historico FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_hist_update_admin" ON public.sup_preco_historico FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "sup_hist_delete_admin" ON public.sup_preco_historico FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "sup_pc_select" ON public.sup_pedidos_compra FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_pc_insert" ON public.sup_pedidos_compra FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_pc_update" ON public.sup_pedidos_compra FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')))
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_pc_delete" ON public.sup_pedidos_compra FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "sup_pi_select" ON public.sup_pedido_itens FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_pi_insert" ON public.sup_pedido_itens FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_pi_update" ON public.sup_pedido_itens FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')))
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_pi_delete" ON public.sup_pedido_itens FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));

CREATE POLICY "sup_pa_select" ON public.sup_pedido_anexos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_pa_insert" ON public.sup_pedido_anexos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_pa_delete" ON public.sup_pedido_anexos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));

-- Comissionados: gestor só lê
CREATE POLICY "sup_comissionados_select" ON public.sup_comissionados FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_comissionados_admin_all" ON public.sup_comissionados FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

-- Comissões: gestor lê, apura e libera; pagamento só admin
CREATE POLICY "sup_comissoes_select" ON public.sup_comissoes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_comissoes_insert" ON public.sup_comissoes FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_comissoes_update_gestor" ON public.sup_comissoes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup') AND status <> 'paga')
WITH CHECK (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup') AND status <> 'paga');
CREATE POLICY "sup_comissoes_update_admin" ON public.sup_comissoes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "sup_comissoes_delete_admin" ON public.sup_comissoes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "sup_ci_select" ON public.sup_comissao_itens FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_ci_insert" ON public.sup_comissao_itens FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_ci_delete" ON public.sup_comissao_itens FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));

-- Config: gestor só lê
CREATE POLICY "sup_config_select" ON public.sup_config FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));
CREATE POLICY "sup_config_admin_all" ON public.sup_config FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "sup_numeracao_select" ON public.sup_numeracao FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup')));

-- Triggers de updated_at
CREATE TRIGGER trg_sup_fornecedores_updated_at BEFORE UPDATE ON public.sup_fornecedores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sup_produtos_updated_at BEFORE UPDATE ON public.sup_produtos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sup_fp_updated_at BEFORE UPDATE ON public.sup_fornecedor_produtos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sup_pc_updated_at BEFORE UPDATE ON public.sup_pedidos_compra
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Numeração PC26MAI-01
CREATE OR REPLACE FUNCTION public.sup_proximo_numero_pc(p_data date DEFAULT current_date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _meses text[] := ARRAY['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  _ano_mes text;
  _n integer;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::public.app_role)
       OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup'))) THEN
    RAISE EXCEPTION 'Permissao negada.';
  END IF;

  _ano_mes := to_char(p_data, 'YY') || _meses[EXTRACT(MONTH FROM p_data)::int];

  INSERT INTO public.sup_numeracao (ano_mes, ultimo_numero)
  VALUES (_ano_mes, 1)
  ON CONFLICT (ano_mes) DO UPDATE SET ultimo_numero = public.sup_numeracao.ultimo_numero + 1
  RETURNING ultimo_numero INTO _n;

  RETURN 'PC' || _ano_mes || '-' || lpad(_n::text, 2, '0');
END;
$$;