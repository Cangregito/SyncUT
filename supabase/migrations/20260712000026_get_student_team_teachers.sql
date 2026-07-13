CREATE OR REPLACE FUNCTION public.get_my_team_teachers()
RETURNS TABLE(team_id uuid, teacher_id uuid, full_name text, email text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT linked.team_id, linked.teacher_id, profile.full_name, profile.email
  FROM public.tutor_team_teachers AS linked
  JOIN public.profiles AS profile ON profile.id = linked.teacher_id
  WHERE linked.active
    AND public.is_active_tutor_team_member(linked.team_id, (SELECT auth.uid()));
$$;

REVOKE ALL ON FUNCTION public.get_my_team_teachers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_team_teachers() TO authenticated;
