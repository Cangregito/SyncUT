-- ==============================================================================
-- SQUAD 3 - FLUJO PROFESIONAL DE CITAS
-- Disponibilidad, prevencion de traslapes y bitacora de cambios.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.tutor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  modality appointment_modality NOT NULL DEFAULT 'presencial',
  location text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT tutor_availability_valid_range CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_tutor_availability_tutor_day
ON public.tutor_availability(tutor_id, day_of_week, active);

CREATE TABLE IF NOT EXISTS public.appointment_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('created', 'status_changed', 'note_added', 'rescheduled')),
  from_status appointment_status,
  to_status appointment_status,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_audit_appointment_id
ON public.appointment_audit_events(appointment_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_appointment_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('pendiente', 'confirmada') THEN
    IF EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.tutor_id = NEW.tutor_id
        AND a.scheduled_date = NEW.scheduled_date
        AND a.status IN ('pendiente', 'confirmada')
        AND a.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND NEW.starts_at < a.ends_at
        AND NEW.ends_at > a.starts_at
    ) THEN
      RAISE EXCEPTION 'El tutor ya tiene una cita activa en ese horario.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_appointment_overlap ON public.appointments;
CREATE TRIGGER trigger_prevent_appointment_overlap
BEFORE INSERT OR UPDATE OF tutor_id, scheduled_date, starts_at, ends_at, status
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_appointment_overlap();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_touch_appointments_updated_at ON public.appointments;
CREATE TRIGGER trigger_touch_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trigger_touch_tutor_availability_updated_at ON public.tutor_availability;
CREATE TRIGGER trigger_touch_tutor_availability_updated_at
BEFORE UPDATE ON public.tutor_availability
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.tutor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tutor_availability_select_policy" ON public.tutor_availability;
CREATE POLICY "tutor_availability_select_policy"
ON public.tutor_availability
FOR SELECT
TO authenticated
USING (
  active = true
  OR tutor_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator'))
);

DROP POLICY IF EXISTS "tutor_availability_manage_staff" ON public.tutor_availability;
CREATE POLICY "tutor_availability_manage_staff"
ON public.tutor_availability
FOR ALL
TO authenticated
USING (
  tutor_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator'))
)
WITH CHECK (
  tutor_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator'))
);

DROP POLICY IF EXISTS "appointment_audit_select_policy" ON public.appointment_audit_events;
CREATE POLICY "appointment_audit_select_policy"
ON public.appointment_audit_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = appointment_id
    AND (
      a.student_id = auth.uid()
      OR a.tutor_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator'))
    )
  )
);

DROP POLICY IF EXISTS "appointment_audit_insert_participants" ON public.appointment_audit_events;
CREATE POLICY "appointment_audit_insert_participants"
ON public.appointment_audit_events
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = appointment_id
    AND (
      a.student_id = auth.uid()
      OR a.tutor_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator', 'teacher', 'tutor'))
    )
  )
);
