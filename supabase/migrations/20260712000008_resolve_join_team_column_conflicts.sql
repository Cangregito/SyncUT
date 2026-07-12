-- RETURNS TABLE creates PL/pgSQL variables named team_id/tutor_id/student_id.
-- Prefer actual table columns when those names appear in SQL clauses such as
-- ON CONFLICT, while explicit variable references remain fully qualified.
DO $$
DECLARE
  definition text;
BEGIN
  definition := pg_get_functiondef('public.join_tutor_team(text)'::regprocedure);
  definition := replace(
    definition,
    'AS $function$',
    E'AS $function$\n#variable_conflict use_column'
  );
  EXECUTE definition;
END;
$$;
