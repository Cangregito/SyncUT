-- ==============================================================================
-- SQUAD 4 - EMISOR CENTRAL DE NOTIFICACIONES
-- RPC segura para eventos in-app/email respetando preferencias por usuario.
-- ==============================================================================

INSERT INTO public.notification_event_types (slug, label, description, channel) VALUES
  ('appointment.created', 'Cita solicitada', 'Aviso cuando un estudiante solicita una tutoría', 'both'),
  ('appointment.completed', 'Cita completada', 'Aviso cuando una tutoría se marca como completada', 'both'),
  ('appointment.note_added', 'Seguimiento de cita agregado', 'Aviso cuando se registra seguimiento de una tutoría', 'in_app'),
  ('justification.requires_more_info', 'Justificación requiere información', 'Aviso cuando una justificación necesita más evidencia', 'both'),
  ('justification.file_added', 'Evidencia agregada', 'Aviso cuando un alumno agrega evidencia a una justificación', 'in_app'),
  ('incident.comment_added', 'Comentario en incidencia', 'Aviso cuando se agrega seguimiento a una incidencia', 'in_app'),
  ('chatbot.handoff_created', 'Chatbot escalado', 'Aviso cuando una conversación se escala a atención humana', 'in_app')
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.emit_notification(
  p_user_id uuid,
  p_event_type text,
  p_title text,
  p_body text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_triggered_by uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_channel text;
  pref_in_app boolean;
  pref_email boolean;
  target_email text;
  notification_id uuid;
  email_queue_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.';
  END IF;

  SELECT channel INTO event_channel
  FROM public.notification_event_types
  WHERE slug = p_event_type;

  IF event_channel IS NULL THEN
    RAISE EXCEPTION 'Tipo de evento de notificacion no existe: %', p_event_type;
  END IF;

  SELECT
    COALESCE(np.in_app, event_channel IN ('in_app', 'both')),
    COALESCE(np.email, event_channel IN ('email', 'both')),
    pr.email
  INTO pref_in_app, pref_email, target_email
  FROM public.profiles pr
  LEFT JOIN public.notification_preferences np
    ON np.user_id = pr.id
   AND np.event_type = p_event_type
  WHERE pr.id = p_user_id;

  IF target_email IS NULL THEN
    RAISE EXCEPTION 'Usuario destino no existe.';
  END IF;

  IF pref_in_app AND event_channel IN ('in_app', 'both') THEN
    INSERT INTO public.notifications (user_id, event_type, title, body, metadata)
    VALUES (p_user_id, p_event_type, p_title, p_body, COALESCE(p_metadata, '{}'::jsonb))
    RETURNING id INTO notification_id;
  END IF;

  IF pref_email AND event_channel IN ('email', 'both') THEN
    INSERT INTO public.email_queue (user_id, to_email, subject, template_slug, template_data)
    VALUES (
      p_user_id,
      target_email,
      p_title,
      replace(p_event_type, '.', '-'),
      jsonb_build_object(
        'title', p_title,
        'body', p_body,
        'metadata', COALESCE(p_metadata, '{}'::jsonb)
      )
    )
    RETURNING id INTO email_queue_id;
  END IF;

  INSERT INTO public.notification_logs (
    event_type,
    user_id,
    notification_id,
    email_queue_id,
    triggered_by,
    payload
  )
  VALUES (
    p_event_type,
    p_user_id,
    notification_id,
    email_queue_id,
    COALESCE(p_triggered_by, auth.uid()),
    jsonb_build_object(
      'title', p_title,
      'body', p_body,
      'metadata', COALESCE(p_metadata, '{}'::jsonb)
    )
  );

  RETURN notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.emit_notification(uuid, text, text, text, jsonb, uuid) TO authenticated;
