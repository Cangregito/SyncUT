-- ==============================================================================
-- SQUAD 1 - FLUJO PROFESIONAL DE JUSTIFICACIONES
-- Bitacora de revision y trazabilidad de evidencias.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.justification_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  justification_id uuid NOT NULL REFERENCES public.justifications(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('submitted', 'file_added', 'status_changed', 'review_note')),
  from_status justification_status,
  to_status justification_status,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_justification_audit_justification_id
ON public.justification_audit_events(justification_id, created_at DESC);

ALTER TABLE public.justification_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "justification_audit_select_policy" ON public.justification_audit_events;
CREATE POLICY "justification_audit_select_policy"
ON public.justification_audit_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.justifications j
    WHERE j.id = justification_id
    AND (
      j.student_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator'))
    )
  )
);

DROP POLICY IF EXISTS "justification_audit_insert_policy" ON public.justification_audit_events;
CREATE POLICY "justification_audit_insert_policy"
ON public.justification_audit_events
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.justifications j
    WHERE j.id = justification_id
    AND (
      j.student_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator'))
    )
  )
);
