CREATE OR REPLACE FUNCTION public.create_tutor_team(p_name text DEFAULT 'Equipo tutorial')
RETURNS TABLE(id uuid, name text, join_code text, is_active boolean, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  generated_code text;
  inserted_id uuid;
  attempts integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role::text IN ('tutor', 'admin')
  ) THEN
    RAISE EXCEPTION 'El perfil autenticado no tiene rol tutor o administrador.' USING ERRCODE = '42501';
  END IF;

  LOOP
    generated_code := public.generate_tutor_join_code();
    attempts := attempts + 1;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tutor_teams t WHERE t.join_code = generated_code);
    IF attempts >= 20 THEN RAISE EXCEPTION 'No se pudo generar un codigo unico.'; END IF;
  END LOOP;

  INSERT INTO public.tutor_teams (tutor_id, name, join_code)
  VALUES (auth.uid(), COALESCE(NULLIF(BTRIM(p_name), ''), 'Equipo tutorial'), generated_code)
  RETURNING tutor_teams.id INTO inserted_id;

  RETURN QUERY SELECT t.id, t.name, t.join_code, t.is_active, t.created_at
  FROM public.tutor_teams t WHERE t.id = inserted_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_tutor_team(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tutor_team(text) TO authenticated;
