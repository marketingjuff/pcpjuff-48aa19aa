
-- 1. Helper: is current user a team member (has any role)
CREATE OR REPLACE FUNCTION public.is_team_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
$$;

REVOKE EXECUTE ON FUNCTION public.is_team_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member() TO authenticated, service_role;

-- 2. Profiles: restrict SELECT to own row
DROP POLICY IF EXISTS profiles_select_auth ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 3. Pedidos: replace permissive write policies
DROP POLICY IF EXISTS pedidos_insert_auth ON public.pedidos;
DROP POLICY IF EXISTS pedidos_update_auth ON public.pedidos;

CREATE POLICY pedidos_insert_team ON public.pedidos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_team_member());

CREATE POLICY pedidos_update_team ON public.pedidos
  FOR UPDATE TO authenticated
  USING (public.is_team_member())
  WITH CHECK (public.is_team_member());

-- 4. Layouts storage bucket: require team membership for writes; reads stay for team
DROP POLICY IF EXISTS layouts_select_auth ON storage.objects;
DROP POLICY IF EXISTS layouts_insert_auth ON storage.objects;
DROP POLICY IF EXISTS layouts_update_auth ON storage.objects;
DROP POLICY IF EXISTS layouts_delete_auth ON storage.objects;

CREATE POLICY layouts_select_team ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'layouts' AND public.is_team_member());

CREATE POLICY layouts_insert_team ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'layouts' AND public.is_team_member());

CREATE POLICY layouts_update_team ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'layouts' AND public.is_team_member())
  WITH CHECK (bucket_id = 'layouts' AND public.is_team_member());

CREATE POLICY layouts_delete_team ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'layouts' AND public.is_team_member());

-- 5. Revoke EXECUTE on trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
