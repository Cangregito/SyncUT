ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.tutor_teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_team_id ON public.incidents(team_id);
CREATE INDEX IF NOT EXISTS idx_incidents_related_teacher_id ON public.incidents(related_teacher_id);

DROP POLICY IF EXISTS "incidents_insert_own" ON public.incidents;
CREATE POLICY "incidents_insert_active_team_student" ON public.incidents FOR INSERT TO authenticated
WITH CHECK (
  reported_by = (SELECT auth.uid())
  AND public.is_active_tutor_team_member(team_id, (SELECT auth.uid()))
  AND (
    related_teacher_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.tutor_team_teachers AS linked
      WHERE linked.team_id = incidents.team_id
        AND linked.teacher_id = incidents.related_teacher_id
        AND linked.active
    )
  )
);

DROP POLICY IF EXISTS "incidents_select_policy" ON public.incidents;
CREATE POLICY "incidents_select_team_related" ON public.incidents FOR SELECT TO authenticated
USING (
  reported_by = (SELECT auth.uid())
  OR assigned_to = (SELECT auth.uid())
  OR public.is_tutor_team_owner(team_id, (SELECT auth.uid()))
  OR public.has_role(ARRAY['admin'])
);
