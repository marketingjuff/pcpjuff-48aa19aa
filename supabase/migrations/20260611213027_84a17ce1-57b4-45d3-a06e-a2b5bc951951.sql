
CREATE TABLE public.app_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('vendedor','dtf','silk','acabamento')),
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_lists TO authenticated;
GRANT ALL ON public.app_lists TO service_role;
ALTER TABLE public.app_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_lists_select_auth ON public.app_lists
  FOR SELECT TO authenticated USING (true);

CREATE POLICY app_lists_write_admin ON public.app_lists
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

CREATE TRIGGER app_lists_updated_at BEFORE UPDATE ON public.app_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_lists (kind, nome, ordem) VALUES
  ('vendedor','Wander',1),('vendedor','Mirela',2),('vendedor','Gabriel',3),('vendedor','Outros',99),
  ('dtf','Jefferson',1),('dtf','Sarah',2),('dtf','Rubens',3),('dtf','Outros',99),
  ('silk','Gleisson',1),('silk','Marcelo',2),('silk','Outros',99),
  ('acabamento','Vanessa',1),('acabamento','Patrícia',2),('acabamento','Juliana',3),('acabamento','Outros',99)
ON CONFLICT (kind, nome) DO NOTHING;
