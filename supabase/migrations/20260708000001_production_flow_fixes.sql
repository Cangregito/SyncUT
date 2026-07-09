-- Production fixes for preferences, tutor teams, incident closure and evidence files.

DELETE FROM public.notification_preferences p
USING public.notification_preferences d
WHERE p.user_id = d.user_id
  AND p.event_type = d.event_type
  AND (
    p.updated_at < d.updated_at
    OR (p.updated_at = d.updated_at AND p.id::text < d.id::text)
  );

CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_user_event_unique
  ON public.notification_preferences(user_id, event_type);

CREATE OR REPLACE FUNCTION public.create_tutor_team(p_name text DEFAULT 'Equipo tutorial')
RETURNS TABLE (
  id uuid,
  name text,
  join_code text,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_role text;
  generated_code text;
  attempts integer := 0;
BEGIN
  SELECT p.role INTO current_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF current_role NOT IN ('tutor', 'admin') THEN
    RAISE EXCEPTION 'Solo tutores o administradores pueden crear equipos.' USING ERRCODE = '42501';
  END IF;

  LOOP
    generated_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    attempts := attempts + 1;

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.tutor_teams tt
      WHERE tt.join_code = generated_code
        AND tt.is_active = true
    );

    IF attempts > 10 THEN
      RAISE EXCEPTION 'No se pudo generar un codigo unico de equipo.';
    END IF;
  END LOOP;

  RETURN QUERY
  INSERT INTO public.tutor_teams (tutor_id, name, join_code)
  VALUES (auth.uid(), COALESCE(NULLIF(BTRIM(p_name), ''), 'Equipo tutorial'), generated_code)
  RETURNING tutor_teams.id, tutor_teams.name, tutor_teams.join_code, tutor_teams.is_active, tutor_teams.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tutor_team(text) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidencias_justificaciones',
  'evidencias_justificaciones',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types,
    public = EXCLUDED.public;

DROP POLICY IF EXISTS "Alumnos pueden subir evidencias" ON storage.objects;
CREATE POLICY "Alumnos pueden subir evidencias" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'evidencias_justificaciones'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Lectura de evidencias restringida" ON storage.objects;
CREATE POLICY "Lectura de evidencias restringida" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'evidencias_justificaciones'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'coordinator', 'teacher')
    )
    OR EXISTS (
      SELECT 1
      FROM public.tutorship_assignments ta
      WHERE ta.tutor_id = auth.uid()
        AND ta.student_id::text = (storage.foldername(name))[1]
        AND ta.status = 'active'
    )
  )
);

DROP POLICY IF EXISTS "incidents_update_staff" ON public.incidents;
CREATE POLICY "incidents_update_staff"
ON public.incidents
FOR UPDATE
TO authenticated
USING (
  assigned_to = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'coordinator')
  )
  OR EXISTS (
    SELECT 1
    FROM public.tutorship_assignments ta
    WHERE ta.tutor_id = auth.uid()
      AND ta.student_id = incidents.reported_by
      AND ta.status = 'active'
  )
)
WITH CHECK (
  assigned_to = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'coordinator')
  )
  OR EXISTS (
    SELECT 1
    FROM public.tutorship_assignments ta
    WHERE ta.tutor_id = auth.uid()
      AND ta.student_id = incidents.reported_by
      AND ta.status = 'active'
  )
);
