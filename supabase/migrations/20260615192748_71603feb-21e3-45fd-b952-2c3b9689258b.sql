DROP POLICY IF EXISTS pedidos_delete_team ON public.pedidos;
CREATE POLICY pedidos_delete_team ON public.pedidos FOR DELETE TO authenticated USING (public.is_team_member());