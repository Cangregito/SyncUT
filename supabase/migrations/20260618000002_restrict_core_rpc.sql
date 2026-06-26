-- Supabase grants function execution to API roles by default. Platform-core
-- helpers are authenticated-only, even though they also validate auth.uid().

REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
REVOKE ALL ON FUNCTION public.has_role(text[]) FROM anon;
REVOKE ALL ON FUNCTION public.set_user_role(uuid, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;
