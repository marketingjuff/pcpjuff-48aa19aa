
-- 1) Ampliar CHECK de app_lists.kind
ALTER TABLE public.app_lists DROP CONSTRAINT app_lists_kind_check;
ALTER TABLE public.app_lists ADD CONSTRAINT app_lists_kind_check
  CHECK (kind = ANY (ARRAY[
    'vendedor','dtf','silk','acabamento','frete','pagamento','nf',
    'status_arte','corte_dtf','revelacao_silk','motivo_perda',
    'refacao_problema_arte','refacao_problema_dtf','refacao_problema_silk','refacao_problema_acabamento',
    'refacao_area_identifica','refacao_area_erro',
    'map_fio_fornecedor','map_malharia','map_tinturaria','map_acabamento',
    'destino_perda'
  ]));

-- 2) Seed inicial destino_perda
INSERT INTO public.app_lists (kind, nome, ordem) VALUES
  ('destino_perda','Reciclagem',10),
  ('destino_perda','Revenda',20),
  ('destino_perda','Uniforme',30);

-- 3) Tabela perdas_manuais
CREATE TABLE public.perdas_manuais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT CURRENT_DATE,
  modelo text NOT NULL,
  cor text NOT NULL,
  tamanho text NOT NULL,
  qtd integer NOT NULL CHECK (qtd > 0),
  motivo text,
  oficina_id uuid REFERENCES public.oficinas(id),
  berco text,
  destino text,
  responsavel text,
  observacoes text,
  registrado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perdas_manuais TO authenticated;
GRANT ALL ON public.perdas_manuais TO service_role;

ALTER TABLE public.perdas_manuais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perdas_manuais admin/gestor full access"
  ON public.perdas_manuais
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role));

CREATE TRIGGER update_perdas_manuais_updated_at
  BEFORE UPDATE ON public.perdas_manuais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX perdas_manuais_data_idx ON public.perdas_manuais (data DESC);

-- 4) Tabela perdas_reclassificacoes (imutável por design)
CREATE TABLE public.perdas_reclassificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL,
  refacao_data text NOT NULL,
  refacao_idx integer NOT NULL,
  modelo text NOT NULL,
  cor text NOT NULL,
  tamanho text NOT NULL,
  qtd integer NOT NULL CHECK (qtd > 0),
  motivo_original text,
  area_erro_original text,
  motivo_novo text NOT NULL,
  oficina_id uuid REFERENCES public.oficinas(id),
  berco text,
  destino text,
  observacao text NOT NULL,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.perdas_reclassificacoes TO authenticated;
GRANT ALL ON public.perdas_reclassificacoes TO service_role;

ALTER TABLE public.perdas_reclassificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perdas_reclass select admin/gestor"
  ON public.perdas_reclassificacoes
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role));

CREATE POLICY "perdas_reclass insert admin/gestor"
  ON public.perdas_reclassificacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role));

-- Sem policies de UPDATE/DELETE: imutável por design.

CREATE INDEX perdas_reclass_pedido_idx ON public.perdas_reclassificacoes (pedido_id, refacao_data);
