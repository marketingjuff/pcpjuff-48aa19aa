CREATE POLICY app_lists_insert_team ON public.app_lists FOR INSERT TO authenticated WITH CHECK (public.is_team_member());
CREATE POLICY app_lists_update_team ON public.app_lists FOR UPDATE TO authenticated USING (public.is_team_member()) WITH CHECK (public.is_team_member());
CREATE POLICY app_lists_delete_team ON public.app_lists FOR DELETE TO authenticated USING (public.is_team_member());