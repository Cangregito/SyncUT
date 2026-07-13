ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS related_student_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_related_student_id ON public.incidents(related_student_id);

DROP POLICY IF EXISTS "incidents_insert_active_team_student" ON public.incidents;
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
  AND (
    related_student_id IS NULL
    OR public.is_active_tutor_team_member(team_id, related_student_id)
  )
);
