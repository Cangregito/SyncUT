-- ==============================================================================
-- SQUAD 3 - CITAS Y TUTORIAS
-- Agenda real de sesiones entre estudiantes y tutores/docentes.
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    CREATE TYPE appointment_status AS ENUM ('pendiente', 'confirmada', 'cancelada', 'completada');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_modality') THEN
    CREATE TYPE appointment_modality AS ENUM ('presencial', 'virtual');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  modality appointment_modality NOT NULL DEFAULT 'presencial',
  reason text NOT NULL,
  status appointment_status NOT NULL DEFAULT 'pendiente',
  location text,
  meeting_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT appointments_valid_time_range CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_appointments_student_id ON public.appointments(student_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tutor_id ON public.appointments(tutor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_date ON public.appointments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_tutor_slot_active
ON public.appointments(tutor_id, scheduled_date, starts_at, ends_at)
WHERE status IN ('pendiente', 'confirmada');

CREATE TABLE IF NOT EXISTS public.tutoring_session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  observations text NOT NULL,
  agreements text,
  recommendations text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutoring_notes_appointment_id
ON public.tutoring_session_notes(appointment_id);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutoring_session_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_select_policy" ON public.appointments;
CREATE POLICY "appointments_select_policy"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
  OR tutor_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'coordinator')
  )
);

DROP POLICY IF EXISTS "appointments_insert_student_or_staff" ON public.appointments;
CREATE POLICY "appointments_insert_student_or_staff"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (
  student_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'coordinator', 'teacher', 'tutor')
  )
);

DROP POLICY IF EXISTS "appointments_update_participants_or_staff" ON public.appointments;
CREATE POLICY "appointments_update_participants_or_staff"
ON public.appointments
FOR UPDATE
TO authenticated
USING (
  student_id = auth.uid()
  OR tutor_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'coordinator', 'teacher', 'tutor')
  )
)
WITH CHECK (
  student_id = auth.uid()
  OR tutor_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'coordinator', 'teacher', 'tutor')
  )
);

DROP POLICY IF EXISTS "tutoring_notes_select_policy" ON public.tutoring_session_notes;
CREATE POLICY "tutoring_notes_select_policy"
ON public.tutoring_session_notes
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
      OR EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'coordinator')
      )
    )
  )
);

DROP POLICY IF EXISTS "tutoring_notes_insert_staff" ON public.tutoring_session_notes;
CREATE POLICY "tutoring_notes_insert_staff"
ON public.tutoring_session_notes
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = appointment_id
    AND (
      a.tutor_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'coordinator', 'teacher', 'tutor')
      )
    )
  )
);

INSERT INTO public.notification_event_types
(slug, label, description, channel)
VALUES
  ('appointment.created', 'Cita solicitada', 'Aviso cuando un estudiante solicita una tutoría', 'both'),
  ('appointment.completed', 'Cita completada', 'Aviso cuando una tutoría se marca como completada', 'both')
ON CONFLICT (slug) DO NOTHING;
