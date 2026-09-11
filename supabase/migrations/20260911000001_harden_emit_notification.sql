-- ==============================================================================
-- HALLAZGO B2 - emit_notification permitia suplantar avisos y encolar correos
--
-- Antes: SECURITY DEFINER concedida a `authenticated`, con la unica comprobacion
-- de que auth.uid() no fuera nulo. Cualquier sesion podia escribir una
-- notificacion en la bandeja de cualquier usuario, encolar un correo real a su
-- direccion y declarar a un tercero como actor mediante p_triggered_by.
--
-- Ahora: el actor se toma siempre de auth.uid() (p_triggered_by se ignora) y el
-- destinatario debe estar relacionado con quien llama. Si no lo esta, la
-- funcion no inserta nada y devuelve NULL en lugar de abortar: varias funciones
-- internas la invocan con PERFORM y una excepcion cancelaria operaciones
-- legitimas como unirse a un equipo.
-- ==============================================================================

-- Equipos activos a los que pertenece un usuario, sea cual sea su rol en ellos.
CREATE OR REPLACE FUNCTION public.team_ids_for_user(p_user uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id
  FROM public.tutor_teams t
  WHERE t.tutor_id = p_user AND t.is_active

  UNION

  SELECT m.team_id
  FROM public.tutor_team_members m
  JOIN public.tutor_teams t ON t.id = m.team_id
  WHERE m.student_id = p_user AND m.status = 'active' AND t.is_active

  UNION

  SELECT tt.team_id
  FROM public.tutor_team_teachers tt
  JOIN public.tutor_teams t ON t.id = tt.team_id
  WHERE tt.teacher_id = p_user AND tt.active AND t.is_active;
$$;

-- Relacion efectiva entre el usuario autenticado y un destinatario.
CREATE OR REPLACE FUNCTION public.can_notify_user(p_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_target IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND (
      -- Avisos para uno mismo.
      p_target = auth.uid()

      -- Gobernanza.
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role::text = 'admin'
      )

      -- Tutoria asignada, en cualquier direccion.
      OR EXISTS (
        SELECT 1 FROM public.tutorship_assignments ta
        WHERE ta.status = 'active'
          AND (
            (ta.tutor_id = auth.uid() AND ta.student_id = p_target)
            OR (ta.tutor_id = p_target AND ta.student_id = auth.uid())
          )
      )

      -- Una cita en comun.
      OR EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE (a.tutor_id = auth.uid() AND a.student_id = p_target)
           OR (a.student_id = auth.uid() AND a.tutor_id = p_target)
      )

      -- Un equipo tutorial en comun: tutor propietario, alumno activo o docente
      -- vinculado cuentan por igual.
      OR EXISTS (
        SELECT 1
        FROM public.team_ids_for_user(auth.uid()) AS mine(team_id)
        JOIN public.team_ids_for_user(p_target) AS theirs(team_id)
          ON mine.team_id = theirs.team_id
      )
    );
$$;

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
  actor_id uuid;
BEGIN
  actor_id := auth.uid();

  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.';
  END IF;

  -- El actor nunca se acepta desde el parametro: se ignora p_triggered_by.
  IF NOT public.can_notify_user(p_user_id) THEN
    RAISE WARNING 'emit_notification: % no puede notificar a %', actor_id, p_user_id;
    RETURN NULL;
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
    actor_id,
    jsonb_build_object(
      'title', p_title,
      'body', p_body,
      'metadata', COALESCE(p_metadata, '{}'::jsonb)
    )
  );

  RETURN notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.can_notify_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.team_ids_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_notify_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_ids_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.emit_notification(uuid, text, text, text, jsonb, uuid) TO authenticated;
