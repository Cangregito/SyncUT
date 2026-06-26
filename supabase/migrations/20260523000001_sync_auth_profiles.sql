-- Migration: Sincronización automática de auth.users a public.profiles
-- Created At: 2026-05-23
-- This ensures that every new user registered via Supabase Auth automatically
-- gets a least-privileged profile record. Roles are never accepted from
-- user-controlled metadata.

-- 1. Crear función que gestiona la inserción automática
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(NULLIF(BTRIM(new.raw_user_meta_data->>'full_name'), ''), 'Nuevo Usuario'),
    'student'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2. Crear el trigger sobre la tabla de autenticación
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
