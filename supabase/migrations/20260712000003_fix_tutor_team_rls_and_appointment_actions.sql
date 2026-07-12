-- Break the circular RLS dependency between tutor_teams and tutor_team_members.
-- These helpers run as their owner, so their internal lookups do not trigger
-- the caller's row-level policies again.

CREATE OR REPLACE FUNCTION public.is_active_tutor_team_member(
  requested_team_id uuid,
  requested_student_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tutor_team_members AS member
    WHERE member.team_id = requested_team_id
      AND member.student_id = requested_student_id
      AND member.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tutor_team_owner(
  requested_team_id uuid,
  requested_tutor_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tutor_teams AS team
    WHERE team.id = requested_team_id
      AND team.tutor_id = requested_tutor_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_tutor_team_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_tutor_team_owner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_tutor_team_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tutor_team_owner(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "tutor_teams_select_related" ON public.tutor_teams;
CREATE POLICY "tutor_teams_select_related"
  ON public.tutor_teams
  FOR SELECT
  TO authenticated
  USING (
    tutor_id = (SELECT auth.uid())
    OR public.has_role(ARRAY['admin', 'tutor'])
    OR public.is_active_tutor_team_member(id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "tutor_team_members_select_related" ON public.tutor_team_members;
CREATE POLICY "tutor_team_members_select_related"
  ON public.tutor_team_members
  FOR SELECT
  TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR public.has_role(ARRAY['admin', 'tutor'])
    OR public.is_tutor_team_owner(team_id, (SELECT auth.uid()))
  );

-- Appointment mutations are exposed through guarded, atomic functions. This
-- avoids partial writes (attendance saved while the appointment stays open)
-- and does not depend on nested profile RLS checks.
CREATE OR REPLACE FUNCTION public.change_appointment_status(
  p_appointment_id uuid,
  p_status public.appointment_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_row public.appointments%ROWTYPE;
  actor_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO current_row
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  SELECT role::text INTO actor_role FROM public.profiles WHERE id = auth.uid();
  IF actor_role NOT IN ('admin', 'tutor')
     AND NOT (actor_role = 'student' AND current_row.student_id = auth.uid() AND p_status = 'cancelada') THEN
    RAISE EXCEPTION 'Not allowed to update this appointment';
  END IF;

  IF NOT (
    (current_row.status = 'pendiente' AND p_status IN ('confirmada', 'cancelada'))
    OR (current_row.status = 'confirmada' AND p_status IN ('completada', 'cancelada', 'no_asistio'))
  ) THEN
    RAISE EXCEPTION 'Invalid appointment status transition: % -> %', current_row.status, p_status;
  END IF;

  UPDATE public.appointments
  SET status = p_status, updated_at = now()
  WHERE id = p_appointment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_appointment_attendance(
  p_appointment_id uuid,
  p_status public.appointment_attendance_status,
  p_notes text DEFAULT NULL
)
RETURNS public.appointment_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_row public.appointments%ROWTYPE;
  actor_role text;
  next_status public.appointment_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO current_row FROM public.appointments
  WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;

  SELECT role::text INTO actor_role FROM public.profiles WHERE id = auth.uid();
  IF actor_role NOT IN ('admin', 'tutor') THEN
    RAISE EXCEPTION 'Not allowed to record attendance';
  END IF;
  IF current_row.status <> 'confirmada' THEN
    RAISE EXCEPTION 'Attendance requires a confirmed appointment';
  END IF;

  next_status := CASE p_status
    WHEN 'attended' THEN 'completada'::public.appointment_status
    WHEN 'no_show' THEN 'no_asistio'::public.appointment_status
    ELSE 'cancelada'::public.appointment_status
  END;

  INSERT INTO public.appointment_attendance
    (appointment_id, status, recorded_by, notes, updated_at)
  VALUES (p_appointment_id, p_status, auth.uid(), NULLIF(BTRIM(p_notes), ''), now())
  ON CONFLICT (appointment_id) DO UPDATE SET
    status = EXCLUDED.status,
    recorded_by = EXCLUDED.recorded_by,
    notes = EXCLUDED.notes,
    updated_at = now();

  UPDATE public.appointments SET status = next_status, updated_at = now()
  WHERE id = p_appointment_id;
  RETURN next_status;
END;
$$;

REVOKE ALL ON FUNCTION public.change_appointment_status(uuid, public.appointment_status) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_appointment_attendance(uuid, public.appointment_attendance_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_appointment_status(uuid, public.appointment_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_appointment_attendance(uuid, public.appointment_attendance_status, text) TO authenticated;
