-- Joining depends on the authenticated role, not on a particular email shape.
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

  SELECT email, full_name, role::text INTO caller_email, caller_name, caller_role
  FROM public.profiles WHERE id = auth.uid();

  IF caller_role IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'Solo alumnos pueden unirse a equipos tutoriales.' USING ERRCODE = '42501';
  END IF;

  normalized_code := upper(regexp_replace(COALESCE(p_join_code, ''), '\s+', '', 'g'));
  IF normalized_code !~ '^[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'El codigo debe contener 6 letras o numeros.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO target_team FROM public.tutor_teams
  WHERE tutor_teams.join_code = normalized_code AND tutor_teams.is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Codigo de equipo no valido o inactivo.' USING ERRCODE = 'P0002';
  END IF;

  SELECT student_code INTO student_code_value FROM public.students WHERE id = auth.uid();
  student_code_value := COALESCE(
    student_code_value,
    upper(substring(caller_email from '^al([0-9]{8})@utcj\.edu\.mx$')),
    'STU-' || upper(left(replace(auth.uid()::text, '-', ''), 12))
  );

  INSERT INTO public.students (id, student_code, cohort, career, enrollment_date)
  VALUES (auth.uid(), student_code_value, 'Sin cohorte', 'Sin carrera asignada', CURRENT_DATE)
  ON CONFLICT (id) DO UPDATE SET updated_at = now();

  UPDATE public.tutor_team_members SET status = 'removed'
  WHERE student_id = auth.uid() AND status = 'active' AND team_id <> target_team.id;
  UPDATE public.tutorship_assignments SET status = 'transferred'
  WHERE student_id = auth.uid() AND status = 'active' AND tutor_id <> target_team.tutor_id;

  INSERT INTO public.tutor_team_members (team_id, student_id, status)
  VALUES (target_team.id, auth.uid(), 'active')
  ON CONFLICT (team_id, student_id) DO UPDATE SET status = 'active', joined_at = now();

  INSERT INTO public.tutorship_assignments (tutor_id, student_id, status)
  VALUES (target_team.tutor_id, auth.uid(), 'active')
  ON CONFLICT (tutor_id, student_id) DO UPDATE SET status = 'active';

  PERFORM public.emit_notification(
    target_team.tutor_id, 'tutor_team.joined', 'Alumno unido a tu equipo tutorial',
    COALESCE(caller_name, caller_email, 'Un alumno') || ' se unio con el codigo ' || normalized_code || '.',
    jsonb_build_object('team_id', target_team.id, 'student_id', auth.uid()), auth.uid()
  );

  RETURN QUERY SELECT target_team.id, target_team.tutor_id, auth.uid(), target_team.join_code;
END;
$$;

REVOKE ALL ON FUNCTION public.join_tutor_team(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_tutor_team(text) TO authenticated;
