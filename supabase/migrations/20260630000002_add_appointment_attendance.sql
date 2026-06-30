DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'appointment_status' AND e.enumlabel = 'no_asistio'
  ) THEN
    ALTER TYPE public.appointment_status ADD VALUE 'no_asistio';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_attendance_status') THEN
    CREATE TYPE public.appointment_attendance_status AS ENUM (
      'attended',
      'no_show',
      'excused_absence'
    );
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.appointment_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  status public.appointment_attendance_status NOT NULL,
  recorded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  notes text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_attendance_appointment
  ON public.appointment_attendance(appointment_id);

CREATE INDEX IF NOT EXISTS idx_appointment_attendance_status
  ON public.appointment_attendance(status, recorded_at DESC);

ALTER TABLE public.appointment_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointment_attendance_participants_read"
  ON public.appointment_attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.id = appointment_attendance.appointment_id
        AND (a.student_id = auth.uid() OR a.tutor_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'coordinator')
    )
  );

CREATE POLICY "appointment_attendance_staff_write"
  ON public.appointment_attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    recorded_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'coordinator', 'teacher', 'tutor')
    )
  );

CREATE POLICY "appointment_attendance_staff_update"
  ON public.appointment_attendance FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'coordinator', 'teacher', 'tutor')
    )
  )
  WITH CHECK (
    recorded_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'coordinator')
    )
  );

INSERT INTO public.notification_event_types (slug, label, description, channel)
VALUES
  ('appointment.attendance_recorded', 'Asistencia de tutoría registrada', 'Se registró asistencia o inasistencia en una cita de tutoría.', 'both')
ON CONFLICT (slug) DO NOTHING;
