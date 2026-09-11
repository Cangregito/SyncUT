-- ==============================================================================
-- HALLAZGO B3 - los RPC de citas autorizaban por rol, no por propiedad
--
-- Antes: change_appointment_status y record_appointment_attendance solo
-- comprobaban `actor_role IN ('admin','tutor')`. Cualquier tutor podia
-- confirmar, completar, cancelar o marcar inasistencia en las citas de otro
-- tutor y de sus alumnos llamando al RPC directamente; la restriccion de la
-- pantalla no intervenia. Tampoco miraban account_status, asi que una cuenta
-- suspendida conservaba esas capacidades hasta que expiraba su token.
--
-- Ahora: el tutor solo actua sobre las citas donde es `tutor_id`, el alumno
-- solo cancela las suyas, y ambas funciones exigen una cuenta activa.
-- ==============================================================================

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
  actor_status text;
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

  SELECT role::text, account_status::text
    INTO actor_role, actor_status
  FROM public.profiles
  WHERE id = auth.uid();

  IF actor_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Account is not active';
  END IF;

  -- La propiedad de la cita, no solo el rol, decide quien puede moverla.
  IF NOT (
    actor_role = 'admin'
    OR (actor_role = 'tutor' AND current_row.tutor_id = auth.uid())
    OR (actor_role = 'student' AND current_row.student_id = auth.uid() AND p_status = 'cancelada')
  ) THEN
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
  actor_status text;
  next_status public.appointment_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO current_row FROM public.appointments
  WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;

  SELECT role::text, account_status::text
    INTO actor_role, actor_status
  FROM public.profiles
  WHERE id = auth.uid();

  IF actor_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Account is not active';
  END IF;

  IF NOT (
    actor_role = 'admin'
    OR (actor_role = 'tutor' AND current_row.tutor_id = auth.uid())
  ) THEN
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
