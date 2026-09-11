-- ==============================================================================
-- HALLAZGO D3 - "Requiere informacion" era un callejon cerrado
--
-- El tutor podia dejar una justificacion en `requires_more_info`, pero el
-- alumno no tenia ninguna salida: la politica de UPDATE solo le permite tocar
-- filas ya en `pending`, y `resolve_justification` rechaza explicitamente a los
-- estudiantes. Crear otra solicitud tampoco servia, porque la comprobacion de
-- duplicados incluye ese estado. La unica escapatoria era cambiar titulo o
-- fechas, es decir, falsear el expediente.
--
-- Esta migracion abre el camino de vuelta conservando folio y trazabilidad.
-- ==============================================================================

-- La bitacora necesita nombrar el nuevo evento.
ALTER TABLE public.justification_audit_events
  DROP CONSTRAINT IF EXISTS justification_audit_events_event_type_check;

ALTER TABLE public.justification_audit_events
  ADD CONSTRAINT justification_audit_events_event_type_check
  CHECK (event_type IN (
    'submitted',
    'file_added',
    'status_changed',
    'review_note',
    'teacher_received',
    'info_provided'
  ));

INSERT INTO public.notification_event_types (slug, label, description, channel) VALUES
  (
    'justification.info_provided',
    'Informacion adicional enviada',
    'Aviso al tutor cuando el alumno responde a una solicitud de informacion',
    'both'
  )
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.respond_to_justification_info_request(
  p_justification_id uuid,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.justifications%ROWTYPE;
  clean_note text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO current_row
  FROM public.justifications
  WHERE id = p_justification_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Justificacion no encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF current_row.student_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo puedes responder a tus propias solicitudes.' USING ERRCODE = '42501';
  END IF;

  IF current_row.status <> 'requires_more_info' THEN
    RAISE EXCEPTION 'Esta solicitud no esta esperando informacion adicional.' USING ERRCODE = '22023';
  END IF;

  clean_note := NULLIF(BTRIM(p_note), '');

  IF clean_note IS NULL OR length(clean_note) < 10 THEN
    RAISE EXCEPTION 'Explica en al menos 10 caracteres que informacion agregas.' USING ERRCODE = '22023';
  END IF;

  -- Vuelve a la cola de revision conservando folio, fechas y evidencias.
  UPDATE public.justifications
  SET status = 'pending', updated_at = now()
  WHERE id = p_justification_id;

  INSERT INTO public.justification_audit_events
    (justification_id, actor_id, event_type, from_status, to_status, note)
  VALUES
    (p_justification_id, auth.uid(), 'info_provided', 'requires_more_info', 'pending', clean_note);
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_justification_info_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_justification_info_request(uuid, text) TO authenticated;
