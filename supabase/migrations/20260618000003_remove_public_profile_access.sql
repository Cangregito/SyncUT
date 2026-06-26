-- Removes a permissive policy that existed directly in the remote database
-- outside the repository migration history.

DROP POLICY IF EXISTS "Permitir lectura de perfiles" ON public.profiles;

REVOKE ALL ON TABLE public.profiles FROM anon;

-- Authenticated users need only SELECT plus the explicitly safe update columns.
REVOKE ALL ON TABLE public.profiles FROM authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (full_name, phone, avatar_url, updated_at)
  ON TABLE public.profiles
  TO authenticated;
