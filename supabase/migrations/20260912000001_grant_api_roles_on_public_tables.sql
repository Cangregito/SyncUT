-- ==============================================================================
-- PRIVILEGIOS DE LOS ROLES DE LA API SOBRE EL ESQUEMA public
--
-- Las imagenes recientes de Postgres de Supabase (17.6.1.121 en local) ya no
-- conceden SELECT/INSERT/UPDATE/DELETE a `authenticated` ni `service_role`
-- sobre las tablas nuevas de `public`: los privilegios por defecto quedan en
-- "Dxtm" (truncate, references, trigger, maintain). Ninguna migracion
-- concedia esos privilegios de forma explicita porque el proyecto en la nube
-- nacio con los valores antiguos, asi que un entorno levantado desde cero
-- (supabase start) fallaba con "permission denied for table ..." en cuanto
-- una politica RLS consultaba otra tabla.
--
-- Esta migracion deja el contrato explicito y reproducible:
--   * authenticated y service_role pueden operar las tablas y secuencias
--     (RLS sigue decidiendo que filas ve cada quien).
--   * anon NO recibe privilegios sobre tablas: ninguna pantalla consulta
--     datos sin sesion.
--   * Se reaplican las restricciones puntuales que migraciones anteriores ya
--     habian fijado (profiles solo lectura, audit_logs sin update/delete).
--   * Los mismos privilegios quedan como valor por defecto para tablas y
--     secuencias que se creen despues.
-- En la nube es idempotente: solo confirma privilegios que ya existian.
-- ==============================================================================

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Restricciones ya establecidas por migraciones anteriores, reafirmadas aqui
-- para que el GRANT masivo de arriba no las deshaga.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM authenticated;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs FROM authenticated, anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
