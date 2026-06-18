-- ==============================================================================
-- MIGRACIÓN UNIFICADA DE LA PLATAFORMA INTEGRAL (SyncUT)
-- Fecha de creación: 2026-06-05
-- Este script crea todas las tablas, enums, triggers y storage para:
-- 1. Relaciones Académicas (students, teachers, tutorship_assignments)
-- 2. Justificaciones y Asistencias (attendance_records, justifications, files)
-- 3. Notificaciones y Email (event_types, preferences, email_queue, logs)
-- ==============================================================================

-- ==============================================================================
-- 1. ENUMS (Tipos de datos personalizados)
-- ==============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
        CREATE TYPE attendance_status AS ENUM ('present', 'tardy', 'absent');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'justification_status') THEN
        CREATE TYPE justification_status AS ENUM ('pending', 'approved', 'rejected', 'requires_more_info');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'justification_category') THEN
        CREATE TYPE justification_category AS ENUM ('medical', 'official', 'personal');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_status') THEN
        CREATE TYPE email_status AS ENUM ('pending', 'processing', 'sent', 'failed', 'cancelled');
    END IF;
END $$;

-- ==============================================================================
-- 2. TABLAS DE RELACIONES ACADÉMICAS (Staff & Squad 2)
-- ==============================================================================

-- 2.1 Perfil Extendido de Estudiantes
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_code text UNIQUE NOT NULL,
  cohort text NOT NULL,
  career text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'dropped')),
  enrollment_date date NOT NULL,
  expected_graduation date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_cohort ON public.students(cohort);
CREATE INDEX IF NOT EXISTS idx_students_career ON public.students(career);

-- 2.2 Perfil Extendido de Docentes
CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_code text UNIQUE NOT NULL,
  department text NOT NULL,
  specialization text[],
  availability_hours jsonb,
  office_location text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.3 Asignación de Tutorías
CREATE TABLE IF NOT EXISTS public.tutorship_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assigned_date date DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'transferred')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(tutor_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_tutorship_tutor_id ON public.tutorship_assignments(tutor_id);
CREATE INDEX IF NOT EXISTS idx_tutorship_student_id ON public.tutorship_assignments(student_id);

-- ==============================================================================
-- 3. TABLAS DE JUSTIFICACIONES Y ASISTENCIAS (Squad 1)
-- ==============================================================================

-- 3.1 Registro de Asistencias
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_name text NOT NULL,
  record_date date NOT NULL,
  status attendance_status NOT NULL,
  is_converted boolean DEFAULT false, -- Indica si este retardo ya sumó para una falta
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance_records(status);

-- 3.2 Trámite de Justificación
CREATE TABLE IF NOT EXISTS public.justifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category justification_category NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status justification_status DEFAULT 'pending',
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_justifications_student_id ON public.justifications(student_id);

-- 3.3 Evidencias Adjuntas
CREATE TABLE IF NOT EXISTS public.justification_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  justification_id uuid NOT NULL REFERENCES public.justifications(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL, -- Ruta en Supabase Storage
  content_type text NOT NULL,
  file_size_bytes integer NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 4. TABLAS DE NOTIFICACIONES Y EMAIL (Squad 4)
-- ==============================================================================

-- 4.1 Catálogo de Tipos de Eventos
CREATE TABLE IF NOT EXISTS public.notification_event_types (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,          -- e.g. 'appointment.confirmed'
  label       TEXT NOT NULL,                 -- Etiqueta legible
  description TEXT,
  channel     TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'both')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.2 Notificaciones in-app
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL REFERENCES public.notification_event_types(slug),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  metadata     JSONB DEFAULT '{}',            -- Cita_id, justificacion_id, etc.
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id      ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read      ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at   ON public.notifications(created_at DESC);

-- 4.3 Preferencias de Canales
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL REFERENCES public.notification_event_types(slug),
  in_app       BOOLEAN NOT NULL DEFAULT TRUE,
  email        BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON public.notification_preferences(user_id);

-- 4.4 Cola Asíncrona de Emails
CREATE TABLE IF NOT EXISTS public.email_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_email        TEXT NOT NULL,
  subject         TEXT NOT NULL,
  template_slug   TEXT NOT NULL,              -- e.g. 'welcome', 'password-reset'
  template_data   JSONB NOT NULL DEFAULT '{}',
  status          public.email_status NOT NULL DEFAULT 'pending',
  attempts        SMALLINT NOT NULL DEFAULT 0,
  max_attempts    SMALLINT NOT NULL DEFAULT 3,
  last_error      TEXT,
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status, scheduled_at) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_email_queue_user_id ON public.email_queue(user_id);

-- 4.5 Logs de Notificaciones
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT NOT NULL,
  user_id         UUID,
  notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
  email_queue_id  UUID REFERENCES public.email_queue(id) ON DELETE SET NULL,
  triggered_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payload         JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_logs_user_id    ON public.notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_logs_event_type ON public.notification_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_notif_logs_created_at ON public.notification_logs(created_at DESC);

-- ==============================================================================
-- 5. AUTOMATIZACIÓN DE NEGOCIO (TRIGGERS)
-- ==============================================================================

-- Función que convierte automáticamente 3 retardos en 1 falta
CREATE OR REPLACE FUNCTION check_tardiness_conversion()
RETURNS TRIGGER AS $$
DECLARE
    tardy_count INTEGER;
BEGIN
    IF NEW.status = 'tardy' THEN
        SELECT COUNT(*) INTO tardy_count
        FROM public.attendance_records
        WHERE student_id = NEW.student_id
          AND subject_name = NEW.subject_name
          AND status = 'tardy'
          AND is_converted = false;

        IF tardy_count >= 3 THEN
            UPDATE public.attendance_records
            SET is_converted = true
            WHERE student_id = NEW.student_id
              AND subject_name = NEW.subject_name
              AND status = 'tardy'
              AND is_converted = false;

            INSERT INTO public.attendance_records (student_id, subject_name, record_date, status)
            VALUES (NEW.student_id, NEW.subject_name, NEW.record_date, 'absent');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_convert_tardiness ON public.attendance_records;
CREATE TRIGGER trigger_convert_tardiness
AFTER INSERT ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION check_tardiness_conversion();

-- ==============================================================================
-- 6. SEGURIDAD DE DATOS (ROW LEVEL SECURITY - RLS)
-- ==============================================================================

-- 6.1 Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorship_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.justifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.justification_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- 6.2 Políticas de Relaciones Académicas
DROP POLICY IF EXISTS "students_view" ON public.students;
CREATE POLICY "students_view" ON public.students FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  OR EXISTS (SELECT 1 FROM public.tutorship_assignments WHERE tutor_id = auth.uid() AND student_id = id)
);

DROP POLICY IF EXISTS "tutorship_view" ON public.tutorship_assignments;
CREATE POLICY "tutorship_view" ON public.tutorship_assignments FOR SELECT TO authenticated
USING (
  tutor_id = auth.uid()
  OR student_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 6.3 Políticas de Asistencias
DROP POLICY IF EXISTS "attendance_select_policy" ON public.attendance_records;
CREATE POLICY "attendance_select_policy" ON public.attendance_records FOR SELECT TO authenticated
USING (
  student_id = auth.uid() 
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator', 'teacher'))
);

DROP POLICY IF EXISTS "attendance_insert_teacher_policy" ON public.attendance_records;
CREATE POLICY "attendance_insert_teacher_policy" ON public.attendance_records FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);

-- 6.4 Políticas de Justificaciones
DROP POLICY IF EXISTS "justifications_select_policy" ON public.justifications;
CREATE POLICY "justifications_select_policy" ON public.justifications FOR SELECT TO authenticated
USING (
  student_id = auth.uid() 
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator'))
);

DROP POLICY IF EXISTS "justifications_insert_policy" ON public.justifications;
CREATE POLICY "justifications_insert_policy" ON public.justifications FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "justifications_update_policy" ON public.justifications;
CREATE POLICY "justifications_update_policy" ON public.justifications FOR UPDATE TO authenticated
USING (
  (student_id = auth.uid() AND status = 'pending')
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator'))
);

-- 6.5 Políticas de Archivos
DROP POLICY IF EXISTS "files_select_policy" ON public.justification_files;
CREATE POLICY "files_select_policy" ON public.justification_files FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.justifications j
    WHERE j.id = justification_id AND (
      j.student_id = auth.uid() 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator'))
    )
  )
);

DROP POLICY IF EXISTS "files_insert_policy" ON public.justification_files;
CREATE POLICY "files_insert_policy" ON public.justification_files FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.justifications WHERE id = justification_id AND student_id = auth.uid())
);

-- 6.6 Políticas de Notificaciones
DROP POLICY IF EXISTS "users_see_own_notifications" ON public.notifications;
CREATE POLICY "users_see_own_notifications" ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;
CREATE POLICY "users_update_own_notifications" ON public.notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "service_insert_notifications" ON public.notifications;
CREATE POLICY "service_insert_notifications" ON public.notifications FOR INSERT
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "users_manage_own_preferences" ON public.notification_preferences;
CREATE POLICY "users_manage_own_preferences" ON public.notification_preferences FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "service_role_only_email_queue" ON public.email_queue;
CREATE POLICY "service_role_only_email_queue" ON public.email_queue FOR ALL
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_insert_logs" ON public.notification_logs;
CREATE POLICY "service_insert_logs" ON public.notification_logs FOR INSERT
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "users_see_own_logs" ON public.notification_logs;
CREATE POLICY "users_see_own_logs" ON public.notification_logs FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "authenticated_read_event_types" ON public.notification_event_types;
CREATE POLICY "authenticated_read_event_types" ON public.notification_event_types FOR SELECT TO authenticated
USING (TRUE);

-- ==============================================================================
-- 7. SEED DATA (notification_event_types)
-- ==============================================================================
INSERT INTO public.notification_event_types (slug, label, description, channel) VALUES
  ('auth.welcome', 'Bienvenida al sistema', 'Correo enviado al registrarse', 'email'),
  ('auth.password_reset', 'Restablecimiento de contraseña', 'Enlace seguro para recuperar clave', 'email'),
  ('appointment.confirmed', 'Cita confirmada', 'Notificación y email de cita agendada', 'both'),
  ('appointment.cancelled', 'Cita cancelada', 'Aviso de tutoría cancelada', 'both'),
  ('appointment.reminder', 'Recordatorio de cita', 'Alerta antes de iniciar sesión', 'both'),
  ('appointment.status_changed', 'Cambio de estatus de cita', 'Actualización de estado en la agenda', 'both'),
  ('justification.submitted', 'Justificación enviada', 'Alerta in-app de trámite recibido', 'in_app'),
  ('justification.approved', 'Justificación aprobada', 'Notificación y email de justificación aceptada', 'both'),
  ('justification.rejected', 'Justificación rechazada', 'Notificación y email de rechazo de trámite', 'both')
ON CONFLICT (slug) DO NOTHING;

-- ==============================================================================
-- 8. CONFIGURACIÓN DE STORAGE (BUCKET Y RLS DE ARCHIVOS)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidencias_justificaciones', 
  'evidencias_justificaciones', 
  false, 
  5242880, 
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Alumnos pueden subir evidencias" ON storage.objects;
CREATE POLICY "Alumnos pueden subir evidencias" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'evidencias_justificaciones' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Lectura de evidencias restringida" ON storage.objects;
CREATE POLICY "Lectura de evidencias restringida" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'evidencias_justificaciones'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator'))
  )
);
