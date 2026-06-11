DROP POLICY IF EXISTS pedidos_select_auth ON public.pedidos;
CREATE POLICY pedidos_select_team ON public.pedidos FOR SELECT TO authenticated USING (public.is_team_member());

DROP POLICY IF EXISTS feriados_select_auth ON public.feriados;
CREATE POLICY feriados_select_team ON public.feriados FOR SELECT TO authenticated USING (public.is_team_member());

DROP POLICY IF EXISTS app_lists_select_auth ON public.app_lists;
CREATE POLICY app_lists_select_team ON public.app_lists FOR SELECT TO authenticated USING (public.is_team_member());