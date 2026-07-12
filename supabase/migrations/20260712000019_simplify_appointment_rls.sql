DROP POLICY IF EXISTS "appointments_select_policy" ON public.appointments;
CREATE POLICY "appointments_select_policy" ON public.appointments FOR SELECT TO authenticated
USING (student_id = (SELECT auth.uid()) OR tutor_id = (SELECT auth.uid()) OR public.has_role(ARRAY['admin']));

DROP POLICY IF EXISTS "appointments_insert_student_or_staff" ON public.appointments;
CREATE POLICY "appointments_insert_participants" ON public.appointments FOR INSERT TO authenticated
WITH CHECK (
  student_id = (SELECT auth.uid())
  OR (tutor_id = (SELECT auth.uid()) AND public.has_role(ARRAY['tutor']))
  OR public.has_role(ARRAY['admin'])
);

DROP POLICY IF EXISTS "appointments_update_participants_or_staff" ON public.appointments;
CREATE POLICY "appointments_update_participants" ON public.appointments FOR UPDATE TO authenticated
USING (student_id = (SELECT auth.uid()) OR tutor_id = (SELECT auth.uid()) OR public.has_role(ARRAY['admin']))
WITH CHECK (student_id = (SELECT auth.uid()) OR tutor_id = (SELECT auth.uid()) OR public.has_role(ARRAY['admin']));
