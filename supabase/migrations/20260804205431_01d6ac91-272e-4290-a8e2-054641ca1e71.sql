CREATE TABLE public.sup_departamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE UNIQUE INDEX sup_departamentos_nome_uidx ON public.sup_departamentos (lower(nome));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sup_departamentos TO authenticated;
GRANT ALL ON public.sup_departamentos TO service_role;

ALTER TABLE public.sup_departamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sup_departamentos_select" ON public.sup_departamentos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "sup_departamentos_write" ON public.sup_departamentos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER update_sup_departamentos_updated_at
  BEFORE UPDATE ON public.sup_departamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sup_produtos ADD COLUMN IF NOT EXISTS departamento text;

INSERT INTO public.sup_departamentos (nome) VALUES
  ('Produção'), ('Manutenção'), ('Escritório'), ('Limpeza')
ON CONFLICT DO NOTHING;