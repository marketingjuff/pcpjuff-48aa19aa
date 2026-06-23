DROP POLICY IF EXISTS pedidos_delete_team ON public.pedidos;
CREATE POLICY pedidos_delete_admin_gestor ON public.pedidos
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  );