-- ==============================================================================
-- Nombres reales de tutores y validaciones de formularios criticos
-- Fecha: 2026-07-06
-- ==============================================================================

UPDATE public.profiles
SET
  full_name = 'Mtra. Fernanda Ruiz Hernandez',
  updated_at = now()
WHERE id = '00000000-0000-4000-8000-000000000103'::uuid;

UPDATE auth.users
SET
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('full_name', 'Mtra. Fernanda Ruiz Hernandez'),
  updated_at = now()
WHERE id = '00000000-0000-4000-8000-000000000103'::uuid;

UPDATE public.teachers
SET
  department = 'Tutoria Academica y Acompanamiento',
  specialization = ARRAY['Acompanamiento estudiantil', 'Seguimiento academico', 'Tutorias de permanencia'],
  office_location = 'Tutoria A-102',
  updated_at = now()
WHERE id = '00000000-0000-4000-8000-000000000103'::uuid;

UPDATE public.appointments
SET
  location = CASE
    WHEN modality = 'presencial' AND NULLIF(BTRIM(location), '') IS NULL THEN 'Tutoria A-102'
    WHEN modality = 'virtual' THEN NULL
    ELSE BTRIM(location)
  END,
  meeting_url = CASE
    WHEN modality = 'virtual' AND NULLIF(BTRIM(meeting_url), '') IS NULL THEN 'https://meet.google.com/syncut-tutoria'
    WHEN modality = 'presencial' THEN NULL
    ELSE BTRIM(meeting_url)
  END;

UPDATE public.tutor_availability
SET location = CASE
  WHEN modality = 'virtual' AND NULLIF(BTRIM(location), '') IS NULL THEN 'https://meet.google.com/syncut-tutoria'
  WHEN modality = 'presencial' AND NULLIF(BTRIM(location), '') IS NULL THEN 'Tutoria A-102'
  ELSE BTRIM(location)
END;

ALTER TABLE public.appointments
DROP CONSTRAINT IF EXISTS appointments_modality_contact_consistency;

ALTER TABLE public.appointments
ADD CONSTRAINT appointments_modality_contact_consistency
CHECK (
  (
    modality = 'presencial'
    AND NULLIF(BTRIM(location), '') IS NOT NULL
    AND NULLIF(BTRIM(meeting_url), '') IS NULL
  )
  OR
  (
    modality = 'virtual'
    AND NULLIF(BTRIM(location), '') IS NULL
    AND NULLIF(BTRIM(meeting_url), '') IS NOT NULL
    AND meeting_url ~* '^https?://'
  )
);

ALTER TABLE public.tutor_availability
DROP CONSTRAINT IF EXISTS tutor_availability_location_required;

ALTER TABLE public.tutor_availability
ADD CONSTRAINT tutor_availability_location_required
CHECK (
  (
    modality = 'presencial'
    AND NULLIF(BTRIM(location), '') IS NOT NULL
  )
  OR
  (
    modality = 'virtual'
    AND NULLIF(BTRIM(location), '') IS NOT NULL
    AND location ~* '^https?://'
  )
);
