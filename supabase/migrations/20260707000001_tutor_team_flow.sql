-- =============================================================================
-- Tutor team production flow
-- - Admin invites staff accounts from the app.
-- - Tutors create a team with a join code.
-- - Students join a tutor team by code; this also creates the tutorship assignment.
-- - Tutors can notify teachers with legitimate educational context.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tutor_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  join_code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tutor_teams_name_not_blank CHECK (NULLIF(BTRIM(name), '') IS NOT NULL),
  CONSTRAINT tutor_teams_join_code_format CHECK (join_code ~ '^[A-Z0-9]{6}$')
);

CREATE INDEX IF NOT EXISTS idx_tutor_teams_tutor_id ON public.tutor_teams(tutor_id);
CREATE INDEX IF NOT EXISTS idx_tutor_teams_active_code ON public.tutor_teams(join_code) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.tutor_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.tutor_teams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  UNIQUE(team_id, student_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tutor_team_members_one_active_team
  ON public.tutor_team_members(student_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_tutor_team_members_team_id ON public.tutor_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_tutor_team_members_student_id ON public.tutor_team_members(student_id);

ALTER TABLE public.tutor_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tutor_teams_select_related" ON public.tutor_teams;
CREATE POLICY "tutor_teams_select_related"
  ON public.tutor_teams
  FOR SELECT
  TO authenticated
  USING (
    tutor_id = auth.uid()
    OR public.has_role(ARRAY['admin', 'coordinator'])
    OR EXISTS (
      SELECT 1
      FROM public.tutor_team_members m
      WHERE m.team_id = tutor_teams.id
        AND m.student_id = auth.uid()
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS "tutor_team_members_select_related" ON public.tutor_team_members;
CREATE POLICY "tutor_team_members_select_related"
  ON public.tutor_team_members
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.has_role(ARRAY['admin', 'coordinator'])
    OR EXISTS (
      SELECT 1
      FROM public.tutor_teams t
      WHERE t.id = tutor_team_members.team_id
        AND t.tutor_id = auth.uid()
    )
  );

INSERT INTO public.notification_event_types (slug, label, description, channel) VALUES
  ('staff.invited', 'Cuenta institucional invitada', 'Aviso de alta de coordinador, docente o tutor por administración', 'both'),
  ('tutor_team.joined', 'Alumno unido a equipo tutorial', 'Aviso cuando un alumno entra al equipo de su tutor', 'in_app'),
  ('tutor.teacher_message', 'Mensaje tutor-docente', 'Comunicación académica enviada por tutor a docente', 'both')
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.generate_tutor_join_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
  END LOOP;

  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_tutor_team(p_name text DEFAULT 'Equipo tutorial')
RETURNS TABLE(id uuid, name text, join_code text, is_active boolean, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role text;
  generated_code text;
  inserted_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO caller_role
  FROM public.profiles
  WHERE profiles.id = auth.uid();

  IF caller_role NOT IN ('tutor', 'admin') THEN
    RAISE EXCEPTION 'Solo tutores o administradores pueden crear equipos tutoriales.' USING ERRCODE = '42501';
  END IF;

  LOOP
    generated_code := public.generate_tutor_join_code();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.tutor_teams WHERE tutor_teams.join_code = generated_code
    );
  END LOOP;

  INSERT INTO public.tutor_teams (tutor_id, name, join_code)
  VALUES (auth.uid(), COALESCE(NULLIF(BTRIM(p_name), ''), 'Equipo tutorial'), generated_code)
  RETURNING tutor_teams.id INTO inserted_id;

  RETURN QUERY
  SELECT t.id, t.name, t.join_code, t.is_active, t.created_at
  FROM public.tutor_teams t
  WHERE t.id = inserted_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_tutor_team(p_join_code text)
RETURNS TABLE(team_id uuid, tutor_id uuid, student_id uuid, join_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_email text;
  caller_name text;
  caller_role text;
  normalized_code text;
  target_team public.tutor_teams%ROWTYPE;
  student_code_value text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT email, full_name, role
  INTO caller_email, caller_name, caller_role
  FROM public.profiles
  WHERE profiles.id = auth.uid();

  IF caller_role <> 'student' THEN
    RAISE EXCEPTION 'Solo alumnos pueden unirse a equipos tutoriales.' USING ERRCODE = '42501';
  END IF;

  IF caller_email !~* '^al[0-9]{8}@utcj\.edu\.mx$' THEN
    RAISE EXCEPTION 'El alumno debe usar correo institucional UTCJ.' USING ERRCODE = '22023';
  END IF;

  normalized_code := upper(regexp_replace(COALESCE(p_join_code, ''), '\s+', '', 'g'));

  SELECT *
  INTO target_team
  FROM public.tutor_teams
  WHERE tutor_teams.join_code = normalized_code
    AND tutor_teams.is_active = true;

  IF target_team.id IS NULL THEN
    RAISE EXCEPTION 'Código de equipo no válido o inactivo.' USING ERRCODE = 'P0002';
  END IF;

  student_code_value := upper(substring(caller_email from '^al([0-9]{8})@utcj\.edu\.mx$'));

  INSERT INTO public.students (id, student_code, cohort, career, enrollment_date)
  VALUES (auth.uid(), student_code_value, 'Sin cohorte', 'Sin carrera asignada', CURRENT_DATE)
  ON CONFLICT (id) DO UPDATE
  SET student_code = EXCLUDED.student_code,
      updated_at = now();

  UPDATE public.tutor_team_members
  SET status = 'removed'
  WHERE student_id = auth.uid()
    AND status = 'active'
    AND team_id <> target_team.id;

  UPDATE public.tutorship_assignments
  SET status = 'transferred'
  WHERE student_id = auth.uid()
    AND status = 'active'
    AND tutor_id <> target_team.tutor_id;

  INSERT INTO public.tutor_team_members (team_id, student_id, status)
  VALUES (target_team.id, auth.uid(), 'active')
  ON CONFLICT (team_id, student_id) DO UPDATE
  SET status = 'active',
      joined_at = now();

  INSERT INTO public.tutorship_assignments (tutor_id, student_id, status)
  VALUES (target_team.tutor_id, auth.uid(), 'active')
  ON CONFLICT (tutor_id, student_id) DO UPDATE
  SET status = 'active';

  PERFORM public.emit_notification(
    target_team.tutor_id,
    'tutor_team.joined',
    'Alumno unido a tu equipo tutorial',
    COALESCE(caller_name, caller_email, 'Un alumno') || ' se unió con el código ' || normalized_code || '.',
    jsonb_build_object('team_id', target_team.id, 'student_id', auth.uid()),
    auth.uid()
  );

  RETURN QUERY
  SELECT target_team.id, target_team.tutor_id, auth.uid(), target_team.join_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_tutor_teacher_notification(
  p_teacher_id uuid,
  p_team_id uuid,
  p_title text,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  sender_role text;
  teacher_role text;
  team_name text;
  notification_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO sender_role
  FROM public.profiles
  WHERE profiles.id = auth.uid();

  IF sender_role NOT IN ('tutor', 'admin', 'coordinator') THEN
    RAISE EXCEPTION 'No tienes permisos para enviar avisos docentes.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO teacher_role
  FROM public.profiles
  WHERE profiles.id = p_teacher_id;

  IF teacher_role <> 'teacher' THEN
    RAISE EXCEPTION 'El destinatario debe ser docente.' USING ERRCODE = '22023';
  END IF;

  SELECT name INTO team_name
  FROM public.tutor_teams
  WHERE id = p_team_id
    AND (
      tutor_id = auth.uid()
      OR public.has_role(ARRAY['admin', 'coordinator'])
    );

  IF team_name IS NULL THEN
    RAISE EXCEPTION 'Equipo tutorial no visible para el remitente.' USING ERRCODE = '42501';
  END IF;

  notification_id := public.emit_notification(
    p_teacher_id,
    'tutor.teacher_message',
    COALESCE(NULLIF(BTRIM(p_title), ''), 'Mensaje de tutoría'),
    COALESCE(NULLIF(BTRIM(p_body), ''), 'El tutor solicita seguimiento académico.'),
    jsonb_build_object('team_id', p_team_id, 'team_name', team_name, 'sender_id', auth.uid()),
    auth.uid()
  );

  RETURN notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_directory()
RETURNS TABLE(id uuid, full_name text, email text, department text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO caller_role
  FROM public.profiles
  WHERE profiles.id = auth.uid();

  IF caller_role NOT IN ('tutor', 'admin', 'coordinator') THEN
    RAISE EXCEPTION 'No tienes permisos para consultar el directorio docente.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.email, COALESCE(t.department, 'UTCJ')
  FROM public.profiles p
  LEFT JOIN public.teachers t ON t.id = p.id
  WHERE p.role = 'teacher'
  ORDER BY p.full_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_tutor_join_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_tutor_team(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_tutor_team(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_tutor_teacher_notification(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_teacher_directory() TO authenticated;

DROP POLICY IF EXISTS "justifications_select_policy" ON public.justifications;
CREATE POLICY "justifications_select_policy"
  ON public.justifications
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.has_role(ARRAY['admin', 'coordinator'])
    OR EXISTS (
      SELECT 1
      FROM public.tutorship_assignments
      WHERE tutor_id = auth.uid()
        AND student_id = public.justifications.student_id
        AND status = 'active'
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
      FROM public.justifications
      WHERE id = justification_id
        AND (
          student_id = auth.uid()
          OR public.has_role(ARRAY['admin', 'coordinator'])
          OR EXISTS (
            SELECT 1
            FROM public.tutorship_assignments
            WHERE tutor_id = auth.uid()
              AND student_id = public.justifications.student_id
              AND status = 'active'
          )
        )
    )
  );
