-- Oficinas
CREATE TABLE public.oficinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj_cpf text,
  endereco text,
  cep text,
  valor_frete numeric(12,2) NOT NULL DEFAULT 0,
  valores_por_modelo jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oficinas TO authenticated;
GRANT ALL ON public.oficinas TO service_role;
ALTER TABLE public.oficinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY oficinas_admin_all ON public.oficinas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_oficinas_updated_at
  BEFORE UPDATE ON public.oficinas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequência do número de COP (começa em 1)
CREATE SEQUENCE IF NOT EXISTS public.cops_numero_seq START 1;

-- COPs
CREATE TABLE public.cops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL UNIQUE DEFAULT nextval('public.cops_numero_seq'),
  status text NOT NULL DEFAULT 'Aguardando Risco',
  solicitacao_risco date,
  execucao_risco date,
  solicitacao_corte date,
  execucao_corte date,
  observacoes_corte text,
  pecas jsonb NOT NULL DEFAULT '[]'::jsonb,
  cop_pai_id uuid REFERENCES public.cops(id) ON DELETE SET NULL,
  corte_dividido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
ALTER SEQUENCE public.cops_numero_seq OWNED BY public.cops.numero;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cops TO authenticated;
GRANT ALL ON public.cops TO service_role;
GRANT USAGE ON SEQUENCE public.cops_numero_seq TO authenticated;
GRANT ALL ON SEQUENCE public.cops_numero_seq TO service_role;
ALTER TABLE public.cops ENABLE ROW LEVEL SECURITY;
CREATE POLICY cops_admin_all ON public.cops
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_cops_updated_at
  BEFORE UPDATE ON public.cops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX cops_status_idx ON public.cops(status);
CREATE INDEX cops_cop_pai_id_idx ON public.cops(cop_pai_id);