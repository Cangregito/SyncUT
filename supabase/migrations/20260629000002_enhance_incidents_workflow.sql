-- ==============================================================================
-- SQUAD 5 - FLUJO PROFESIONAL DE INCIDENCIAS
-- SLA, asignacion, bitacora y resolucion formal.
-- ==============================================================================

ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'academica',
ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
ADD COLUMN IF NOT EXISTS resolution_summary text,
ADD COLUMN IF NOT EXISTS closed_at timestamptz;

ALTER TABLE public.incidents
DROP CONSTRAINT IF EXISTS incidents_category_check;

ALTER TABLE public.incidents
ADD CONSTRAINT incidents_category_check
CHECK (category IN ('academica', 'tecnica', 'administrativa', 'bienestar', 'seguridad'));

CREATE TABLE IF NOT EXISTS public.incident_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('created', 'assigned', 'status_changed', 'priority_changed', 'comment_added', 'resolved', 'closed')),
  from_status incident_status,
  to_status incident_status,
  from_priority incident_priority,
  to_priority incident_priority,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_audit_incident_id
ON public.incident_audit_events(incident_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.incident_sla_due_at(p_priority incident_priority, p_created_at timestamptz)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_priority = 'alta' THEN p_created_at + interval '24 hours'
    WHEN p_priority = 'media' THEN p_created_at + interval '72 hours'
    ELSE p_created_at + interval '120 hours'
  END;
$$;

CREATE OR REPLACE FUNCTION public.set_incident_sla()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sla_due_at IS NULL THEN
    NEW.sla_due_at = public.incident_sla_due_at(NEW.priority, COALESCE(NEW.created_at, now()));
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_incident_sla ON public.incidents;
CREATE TRIGGER trigger_set_incident_sla
BEFORE INSERT OR UPDATE OF priority, status, assigned_to, resolution_summary
ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.set_incident_sla();

ALTER TABLE public.incident_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incident_audit_select_policy" ON public.incident_audit_events;
CREATE POLICY "incident_audit_select_policy"
ON public.incident_audit_events
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
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator', 'tutor', 'teacher'))
    )
  )
);

DROP POLICY IF EXISTS "incident_audit_insert_policy" ON public.incident_audit_events;
CREATE POLICY "incident_audit_insert_policy"
ON public.incident_audit_events
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.incidents i
    WHERE i.id = incident_id
    AND (
      i.reported_by = auth.uid()
      OR i.assigned_to = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator', 'tutor', 'teacher'))
    )
  )
);

INSERT INTO public.notification_event_types (slug, label, description, channel)
VALUES
  ('incident.comment_added', 'Comentario en incidencia', 'Aviso cuando se agrega seguimiento a una incidencia', 'in_app'),
  ('incident.resolved', 'Incidencia resuelta', 'Aviso cuando una incidencia queda resuelta', 'both'),
  ('incident.closed', 'Incidencia cerrada', 'Aviso cuando una incidencia queda cerrada', 'in_app')
ON CONFLICT (slug) DO NOTHING;
