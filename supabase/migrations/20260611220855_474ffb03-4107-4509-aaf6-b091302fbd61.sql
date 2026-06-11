
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_team_member() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member() TO service_role;
