DROP POLICY IF EXISTS "team_teachers_related_select" ON public.tutor_team_teachers;

CREATE POLICY "team_teachers_related_select"
  ON public.tutor_team_teachers
  FOR SELECT TO authenticated
  USING (
    teacher_id = (SELECT auth.uid())
    OR public.is_tutor_team_owner(team_id, (SELECT auth.uid()))
    OR public.is_active_tutor_team_member(team_id, (SELECT auth.uid()))
    OR public.has_role(ARRAY['admin'])
  );
