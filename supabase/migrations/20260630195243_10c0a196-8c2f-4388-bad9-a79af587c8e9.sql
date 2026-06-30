DROP POLICY IF EXISTS "auth can read color settings" ON public.app_color_settings;
CREATE POLICY "team members can read color settings" ON public.app_color_settings
  FOR SELECT TO authenticated USING (public.is_team_member());