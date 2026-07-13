CREATE OR REPLACE FUNCTION public.teacher_has_justification_delivery(
  requested_justification_id uuid,
  requested_teacher_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.justification_teacher_deliveries AS delivery
    WHERE delivery.justification_id = requested_justification_id
      AND delivery.teacher_id = requested_teacher_id
  );
$$;

REVOKE ALL ON FUNCTION public.teacher_has_justification_delivery(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_has_justification_delivery(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "deliveries_related_select" ON public.justification_teacher_deliveries;
CREATE POLICY "deliveries_related_select"
  ON public.justification_teacher_deliveries
  FOR SELECT TO authenticated
  USING (
    teacher_id = (SELECT auth.uid())
    OR sent_by = (SELECT auth.uid())
    OR public.has_role(ARRAY['admin'])
  );

DROP POLICY IF EXISTS "justifications_select_policy" ON public.justifications;
CREATE POLICY "justifications_select_policy"
  ON public.justifications
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR public.has_role(ARRAY['admin'])
    OR EXISTS (
      SELECT 1 FROM public.tutorship_assignments AS assignment
      WHERE assignment.tutor_id = (SELECT auth.uid())
        AND assignment.student_id = justifications.student_id
        AND assignment.status = 'active'
    )
    OR public.teacher_has_justification_delivery(id, (SELECT auth.uid()))
  );
