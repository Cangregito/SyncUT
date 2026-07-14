-- ==============================================================================
-- MIGRACIÓN DE SEGURIDAD: CONFIGURAR ADMINISTRADOR MASTER
-- Fecha de creación: 2026-06-06
-- Asegura que el usuario Jassiel.rr1502@gmail.com siempre tenga el rol 'admin'
-- a nivel de base de datos de manera inmutable.
-- ==============================================================================

-- 1. Actualizar la función de trigger para nuevos registros
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(NULLIF(BTRIM(new.raw_user_meta_data->>'full_name'), ''), 'Nuevo Usuario'),
    CASE 
      WHEN LOWER(new.email) = 'jassiel.rr1502@gmail.com' THEN 'admin'
      ELSE 'student'
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2. Asegurar que cualquier registro existente con este email tenga rol 'admin'
UPDATE public.profiles
SET role = 'admin'
WHERE LOWER(email) = 'jassiel.rr1502@gmail.com';
