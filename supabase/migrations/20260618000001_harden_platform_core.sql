-- =============================================================================
-- SyncUT platform core hardening
-- - Prevents users from assigning their own role.
-- - Replaces row-based "role = admin" checks with caller-aware helpers.
-- - Makes profile creation ignore user-controlled role metadata.
-- - Adds audited, admin-only role assignment.
-- - Completes baseline access policies for teacher profiles.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = ANY(allowed_roles)
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), ''), 'Nuevo Usuario'),
    'student'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "profiles_self_view" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_update_own_or_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- RLS controls rows, while column privileges prevent changes to identity/role.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone, avatar_url, updated_at)
  ON public.profiles
  TO authenticated;

CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous_role text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can assign roles'
      USING ERRCODE = '42501';
  END IF;

  IF new_role NOT IN ('student', 'teacher', 'tutor', 'admin', 'coordinator') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role
      USING ERRCODE = '22023';
  END IF;

  SELECT role
  INTO previous_role
  FROM public.profiles
  WHERE id = target_user_id
  FOR UPDATE;

  IF previous_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
  SET role = new_role,
      updated_at = now()
  WHERE id = target_user_id;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values
  )
  VALUES (
    auth.uid(),
    'role.changed',
    'profiles',
    target_user_id,
    jsonb_build_object('role', previous_role),
    jsonb_build_object('role', new_role)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "teachers_select" ON public.teachers;
CREATE POLICY "teachers_select"
  ON public.teachers
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(ARRAY['admin', 'coordinator'])
    OR EXISTS (
      SELECT 1
      FROM public.tutorship_assignments
      WHERE tutor_id = public.teachers.id
        AND student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "teachers_update_own_or_admin" ON public.teachers;
CREATE POLICY "teachers_update_own_or_admin"
  ON public.teachers
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- Existing policies that need to identify privileged callers should use helpers.
DROP POLICY IF EXISTS "students_view" ON public.students;
CREATE POLICY "students_view"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(ARRAY['admin', 'coordinator'])
    OR EXISTS (
      SELECT 1
      FROM public.tutorship_assignments
      WHERE tutor_id = auth.uid()
        AND student_id = public.students.id
    )
  );

DROP POLICY IF EXISTS "tutorship_view" ON public.tutorship_assignments;
CREATE POLICY "tutorship_view"
  ON public.tutorship_assignments
  FOR SELECT
  TO authenticated
  USING (
    tutor_id = auth.uid()
    OR student_id = auth.uid()
    OR public.has_role(ARRAY['admin', 'coordinator'])
  );

DROP POLICY IF EXISTS "attendance_select_policy" ON public.attendance_records;
CREATE POLICY "attendance_select_policy"
  ON public.attendance_records
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.has_role(ARRAY['admin', 'coordinator'])
    OR EXISTS (
      SELECT 1
      FROM public.tutorship_assignments
      WHERE tutor_id = auth.uid()
        AND student_id = public.attendance_records.student_id
    )
  );

DROP POLICY IF EXISTS "attendance_insert_teacher_policy" ON public.attendance_records;
CREATE POLICY "attendance_insert_teacher_policy"
  ON public.attendance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "justifications_select_policy" ON public.justifications;
CREATE POLICY "justifications_select_policy"
  ON public.justifications
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.has_role(ARRAY['admin', 'coordinator'])
  );

DROP POLICY IF EXISTS "justifications_update_policy" ON public.justifications;
CREATE POLICY "justifications_update_policy"
  ON public.justifications
  FOR UPDATE
  TO authenticated
  USING (
    (student_id = auth.uid() AND status = 'pending')
    OR public.has_role(ARRAY['admin', 'coordinator'])
  )
  WITH CHECK (
    (student_id = auth.uid() AND status = 'pending')
    OR public.has_role(ARRAY['admin', 'coordinator'])
  );

DROP POLICY IF EXISTS "files_select_policy" ON public.justification_files;
CREATE POLICY "files_select_policy"
  ON public.justification_files
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.justifications
      WHERE id = justification_id
        AND (
          student_id = auth.uid()
          OR public.has_role(ARRAY['admin', 'coordinator'])
        )
    )
  );
