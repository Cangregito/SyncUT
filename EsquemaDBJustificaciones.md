# 🗂️ Esquema de Base de Datos - Módulo de Justificaciones y Asistencias (Squad 1)

Este documento define la estructura relacional, el control de asistencias, las reglas de integridad y las políticas de seguridad (RLS) para la rama `feature/squad-1-justifications`. Todo el script SQL está unificado para ejecutarse como una sola migración en Supabase. 

> **Nota de dependencias:** Este script asume que el Squad 2 ya ejecutó la creación de la tabla `profiles`.

## Script de Migración Unificado (Copiar y Ejecutar en Supabase)

```sql
-- ==============================================================================
-- 1. ENUMS (Tipos de datos personalizados)
-- ==============================================================================
CREATE TYPE attendance_status AS ENUM ('present', 'tardy', 'absent');
CREATE TYPE justification_status AS ENUM ('pending', 'approved', 'rejected', 'requires_more_info');
CREATE TYPE justification_category AS ENUM ('medical', 'official', 'personal');

-- ==============================================================================
-- 2. TABLAS CORE Y CONSTRAINTS
-- ==============================================================================

-- 2.1 Registro de Asistencias, Retardos y Faltas
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_name text NOT NULL,
  record_date date NOT NULL,
  status attendance_status NOT NULL,
  is_converted boolean DEFAULT false, -- Indica si este retardo ya sumó para una falta
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_attendance_student ON public.attendance_records(student_id);
CREATE INDEX idx_attendance_status ON public.attendance_records(status);

-- 2.2 Cabecera del Trámite de Justificación
CREATE TABLE public.justifications (
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
  
  -- Validar que la fecha de fin no sea menor a la de inicio
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_justifications_student_id ON public.justifications(student_id);

-- 2.3 Evidencias Adjuntas (Médicas/Oficiales)
CREATE TABLE public.justification_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  justification_id uuid NOT NULL REFERENCES public.justifications(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL, -- Ruta interna en Supabase Storage
  content_type text NOT NULL,
  file_size_bytes integer NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 3. AUTOMATIZACIÓN DE NEGOCIO (TRIGGERS) - Conversión Retardos a Faltas
-- ==============================================================================

-- Función que convierte automáticamente 3 retardos en 1 falta
CREATE OR REPLACE FUNCTION check_tardiness_conversion()
RETURNS TRIGGER AS $$
DECLARE
    tardy_count INTEGER;
BEGIN
    -- Solo actuar si el nuevo registro es un retardo (tardy)
    IF NEW.status = 'tardy' THEN
        -- Contar retardos no convertidos del alumno en la misma materia
        SELECT COUNT(*) INTO tardy_count
        FROM public.attendance_records
        WHERE student_id = NEW.student_id
          AND subject_name = NEW.subject_name
          AND status = 'tardy'
          AND is_converted = false;

        -- Si llega a 3, convertirlos a falta
        IF tardy_count >= 3 THEN
            -- 1. Marcar los retardos anteriores como convertidos
            UPDATE public.attendance_records
            SET is_converted = true
            WHERE student_id = NEW.student_id
              AND subject_name = NEW.subject_name
              AND status = 'tardy'
              AND is_converted = false;

            -- 2. Insertar la falta generada automáticamente
            INSERT INTO public.attendance_records (student_id, subject_name, record_date, status)
            VALUES (NEW.student_id, NEW.subject_name, NEW.record_date, 'absent');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Disparador que ejecuta la función después de cada inserción
CREATE TRIGGER trigger_convert_tardiness
AFTER INSERT ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION check_tardiness_conversion();

-- ==============================================================================
-- 4. SEGURIDAD DE DATOS (ROW LEVEL SECURITY - RLS)
-- ==============================================================================

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.justifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.justification_files ENABLE ROW LEVEL SECURITY;

-- Políticas para Asistencias
CREATE POLICY "attendance_select_policy"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (
    student_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator', 'teacher'))
  );

CREATE POLICY "attendance_insert_teacher_policy"
  ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

-- Políticas para Justificaciones
CREATE POLICY "justifications_select_policy"
  ON public.justifications FOR SELECT TO authenticated
  USING (
    student_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator'))
  );

CREATE POLICY "justifications_insert_policy"
  ON public.justifications FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "justifications_update_policy"
  ON public.justifications FOR UPDATE TO authenticated
  USING (
    (student_id = auth.uid() AND status = 'pending')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator'))
  );

-- Políticas para Archivos
CREATE POLICY "files_select_policy"
  ON public.justification_files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.justifications j
      WHERE j.id = justification_id AND (
        j.student_id = auth.uid() 
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator'))
      )
    )
  );

CREATE POLICY "files_insert_policy"
  ON public.justification_files FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.justifications WHERE id = justification_id AND student_id = auth.uid())
  );

-- ==============================================================================
-- 5. CONFIGURACIÓN DE STORAGE (BUCKET Y RLS DE ARCHIVOS)
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidencias_justificaciones', 
  'evidencias_justificaciones', 
  false, 
  5242880, 
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
) ON CONFLICT DO NOTHING;

CREATE POLICY "Alumnos pueden subir evidencias"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'evidencias_justificaciones' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Lectura de evidencias restringida"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'evidencias_justificaciones'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator'))
  )
);