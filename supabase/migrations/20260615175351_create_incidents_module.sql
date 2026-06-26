-- ==============================================================================
-- SQUAD 5 - INCIDENCIAS
-- Buzón de quejas, reportes y tablero semáforo
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_priority') THEN
    CREATE TYPE incident_priority AS ENUM ('alta', 'media', 'baja');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_status') THEN
    CREATE TYPE incident_status AS ENUM ('abierta', 'en_proceso', 'resuelta', 'cerrada');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  reported_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  title text NOT NULL,
  area text NOT NULL,
  description text NOT NULL,

  priority incident_priority NOT NULL DEFAULT 'media',
  status incident_status NOT NULL DEFAULT 'abierta',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_incidents_reported_by ON public.incidents(reported_by);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned_to ON public.incidents(assigned_to);
CREATE INDEX IF NOT EXISTS idx_incidents_priority ON public.incidents(priority);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON public.incidents(created_at DESC);

CREATE TABLE IF NOT EXISTS public.incident_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_comments_incident_id 
ON public.incident_comments(incident_id);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incidents_insert_own" ON public.incidents;
CREATE POLICY "incidents_insert_own"
ON public.incidents
FOR INSERT
TO authenticated
WITH CHECK (reported_by = auth.uid());

DROP POLICY IF EXISTS "incidents_select_policy" ON public.incidents;
CREATE POLICY "incidents_select_policy"
ON public.incidents
FOR SELECT
TO authenticated
USING (
  reported_by = auth.uid()
  OR assigned_to = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'coordinator', 'tutor', 'teacher')
  )
);

DROP POLICY IF EXISTS "incidents_update_staff" ON public.incidents;
CREATE POLICY "incidents_update_staff"
ON public.incidents
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'coordinator', 'tutor', 'teacher')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'coordinator', 'tutor', 'teacher')
  )
);

DROP POLICY IF EXISTS "incident_comments_select_policy" ON public.incident_comments;
CREATE POLICY "incident_comments_select_policy"
ON public.incident_comments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.incidents i
    WHERE i.id = incident_id
    AND (
      i.reported_by = auth.uid()
      OR i.assigned_to = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'coordinator', 'tutor', 'teacher')
      )
    )
  )
);

DROP POLICY IF EXISTS "incident_comments_insert_policy" ON public.incident_comments;
CREATE POLICY "incident_comments_insert_policy"
ON public.incident_comments
FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid());

INSERT INTO public.notification_event_types 
(slug, label, description, channel) 
VALUES
  (
    'incident.created',
    'Incidencia creada',
    'Aviso cuando un alumno registra una nueva incidencia',
    'both'
  ),
  (
    'incident.status_changed',
    'Cambio de estado de incidencia',
    'Aviso cuando una incidencia cambia de estado',
    'both'
  ),
  (
    'incident.assigned',
    'Incidencia asignada',
    'Aviso cuando una incidencia se asigna a un responsable',
    'both'
  )