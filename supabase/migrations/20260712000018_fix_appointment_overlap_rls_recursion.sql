-- The overlap trigger reads appointments while an appointment RLS policy is being
-- evaluated. Run this narrowly-scoped check as the function owner to avoid
-- recursive policy evaluation; the trigger remains the only caller.
CREATE OR REPLACE FUNCTION public.prevent_appointment_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IN ('pendiente', 'confirmada') AND EXISTS (
    SELECT 1 FROM public.appointments AS appointment
    WHERE appointment.tutor_id = NEW.tutor_id
      AND appointment.scheduled_date = NEW.scheduled_date
      AND appointment.status IN ('pendiente', 'confirmada')
      AND appointment.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NEW.starts_at < appointment.ends_at
      AND NEW.ends_at > appointment.starts_at
  ) THEN
    RAISE EXCEPTION 'El tutor ya tiene una cita activa en ese horario.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_appointment_overlap() FROM PUBLIC;
