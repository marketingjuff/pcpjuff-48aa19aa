CREATE TABLE public.kpi_pedido_escopo (
  numero_pedido text PRIMARY KEY,
  escopo text NOT NULL CHECK (escopo IN ('custom','store')),
  definido_por uuid,
  definido_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_pedido_escopo TO authenticated;
GRANT ALL ON public.kpi_pedido_escopo TO service_role;

ALTER TABLE public.kpi_pedido_escopo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_escopo_select_team" ON public.kpi_pedido_escopo
  FOR SELECT TO authenticated USING (public.is_team_member());

CREATE POLICY "kpi_escopo_insert_gestor" ON public.kpi_pedido_escopo
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin'::public.app_role)
    OR public.has_role(auth.uid(),'gestor'::public.app_role)
  );

CREATE POLICY "kpi_escopo_update_gestor" ON public.kpi_pedido_escopo
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin'::public.app_role)
    OR public.has_role(auth.uid(),'gestor'::public.app_role)
  ) WITH CHECK (
    public.has_role(auth.uid(),'admin'::public.app_role)
    OR public.has_role(auth.uid(),'gestor'::public.app_role)
  );

CREATE POLICY "kpi_escopo_delete_gestor" ON public.kpi_pedido_escopo
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(),'admin'::public.app_role)
    OR public.has_role(auth.uid(),'gestor'::public.app_role)
  );