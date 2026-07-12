CREATE OR REPLACE FUNCTION public.get_assigned_tutor_busy_dates(p_days_ahead integer DEFAULT 93)
RETURNS TABLE(tutor_id uuid, scheduled_date date)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT DISTINCT appointment.tutor_id, appointment.scheduled_date
  FROM public.appointments AS appointment
  WHERE appointment.status IN ('pendiente', 'confirmada')
    AND appointment.scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + LEAST(GREATEST(p_days_ahead, 1), 366)
    AND EXISTS (
      SELECT 1 FROM public.tutorship_assignments AS assignment
      WHERE assignment.student_id = (SELECT auth.uid())
        AND assignment.tutor_id = appointment.tutor_id
        AND assignment.status = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.get_assigned_tutor_busy_dates(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_assigned_tutor_busy_dates(integer) TO authenticated;
