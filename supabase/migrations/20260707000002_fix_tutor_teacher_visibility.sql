-- =============================================================================
-- Fix tutor/teacher production visibility
-- - Tutors see assigned students and their appointment/justification context.
-- - Teachers see justification cases to add academic notes.
-- - Profile embeds used by appointment/justification screens resolve for related users.
-- =============================================================================

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_related_roles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(ARRAY['admin', 'coordinator'])
    OR (
      public.has_role(ARRAY['teacher'])
      AND role IN ('student', 'teacher', 'tutor', 'coordinator')
    )
    OR EXISTS (
      SELECT 1
      FROM public.tutorship_assignments ta
      WHERE ta.status = 'active'
        AND (
          (ta.tutor_id = auth.uid() AND ta.student_id = profiles.id)
          OR (ta.student_id = auth.uid() AND ta.tutor_id = profiles.id)
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE (a.student_id = auth.uid() OR a.tutor_id = auth.uid())
        AND (a.student_id = profiles.id OR a.tutor_id = profiles.id)
    )
  );

DROP POLICY IF EXISTS "justifications_select_policy" ON public.justifications;
CREATE POLICY "justifications_select_policy"
  ON public.justifications
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.has_role(ARRAY['admin', 'coordinator', 'teacher'])
    OR EXISTS (
      SELECT 1
      FROM public.tutorship_assignments
      WHERE tutor_id = auth.uid()
        AND student_id = public.justifications.student_id
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "justification_audit_select_policy" ON public.justification_audit_events;
CREATE POLICY "justification_audit_select_policy"
  ON public.justification_audit_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.justifications j
      WHERE j.id = justification_id
        AND (
          j.student_id = auth.uid()
          OR public.has_role(ARRAY['admin', 'coordinator', 'teacher'])
          OR EXISTS (
            SELECT 1
            FROM public.tutorship_assignments ta
            WHERE ta.tutor_id = auth.uid()
              AND ta.student_id = j.student_id
              AND ta.status = 'active'
          )
        )
    )
  );

DROP POLICY IF EXISTS "justification_audit_insert_policy" ON public.justification_audit_events;
CREATE POLICY "justification_audit_insert_policy"
  ON public.justification_audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.justifications j
      WHERE j.id = justification_id
        AND (
          j.student_id = auth.uid()
          OR public.has_role(ARRAY['admin', 'coordinator', 'teacher'])
          OR EXISTS (
            SELECT 1
            FROM public.tutorship_assignments ta
            WHERE ta.tutor_id = auth.uid()
              AND ta.student_id = j.student_id
              AND ta.status = 'active'
          )
        )
    )
  );

DROP POLICY IF EXISTS "files_select_policy" ON public.justification_files;
CREATE POLICY "files_select_policy"
  ON public.justification_files
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.justifications j
      WHERE j.id = justification_id
        AND (
          j.student_id = auth.uid()
          OR public.has_role(ARRAY['admin', 'coordinator', 'teacher'])
          OR EXISTS (
            SELECT 1
            FROM public.tutorship_assignments ta
            WHERE ta.tutor_id = auth.uid()
              AND ta.student_id = j.student_id
              AND ta.status = 'active'
          )
        )
    )
  );

DROP POLICY IF EXISTS "appointments_select_policy" ON public.appointments;
CREATE POLICY "appointments_select_policy"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR tutor_id = auth.uid()
    OR public.has_role(ARRAY['admin', 'coordinator'])
    OR EXISTS (
      SELECT 1
      FROM public.tutorship_assignments ta
      WHERE ta.status = 'active'
        AND ta.tutor_id = auth.uid()
        AND ta.student_id = public.appointments.student_id
    )
  );
