-- ==============================================================================
-- DEMO FUNCIONAL RBAC: 1 cuenta por rol y flujo operativo completo
-- Fecha: 2026-07-06
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

WITH demo_users(id, email, full_name, role_name) AS (
  VALUES
    ('00000000-0000-4000-8000-000000000101'::uuid, 'estudiante@syncut.test', 'María López', 'student'),
    ('00000000-0000-4000-8000-000000000102'::uuid, 'docente@syncut.test', 'Dr. Andrés Hidalgo', 'teacher'),
    ('00000000-0000-4000-8000-000000000103'::uuid, 'tutor@syncut.test', 'Mtra. Fernanda Ruiz', 'tutor'),
    ('00000000-0000-4000-8000-000000000104'::uuid, 'coordinacion@syncut.test', 'Ana Ramos', 'coordinator'),
    ('00000000-0000-4000-8000-000000000105'::uuid, 'admin@syncut.test', 'Admin SyncUT', 'admin')
)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  id,
  'authenticated',
  'authenticated',
  email,
  crypt('SyncUT2026!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', full_name),
  now(),
  now()
FROM demo_users
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = COALESCE(auth.users.email_confirmed_at, EXCLUDED.email_confirmed_at),
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = now();

WITH demo_users(id, email, full_name, role_name) AS (
  VALUES
    ('00000000-0000-4000-8000-000000000101'::uuid, 'estudiante@syncut.test', 'María López', 'student'),
    ('00000000-0000-4000-8000-000000000102'::uuid, 'docente@syncut.test', 'Dr. Andrés Hidalgo', 'teacher'),
    ('00000000-0000-4000-8000-000000000103'::uuid, 'tutor@syncut.test', 'Mtra. Fernanda Ruiz', 'tutor'),
    ('00000000-0000-4000-8000-000000000104'::uuid, 'coordinacion@syncut.test', 'Ana Ramos', 'coordinator'),
    ('00000000-0000-4000-8000-000000000105'::uuid, 'admin@syncut.test', 'Admin SyncUT', 'admin')
)
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  id,
  id,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false),
  'email',
  id::text,
  now(),
  now(),
  now()
FROM demo_users
ON CONFLICT (provider, provider_id) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  identity_data = EXCLUDED.identity_data,
  updated_at = now();

WITH demo_users(id, email, full_name, role_name) AS (
  VALUES
    ('00000000-0000-4000-8000-000000000101'::uuid, 'estudiante@syncut.test', 'María López', 'student'),
    ('00000000-0000-4000-8000-000000000102'::uuid, 'docente@syncut.test', 'Dr. Andrés Hidalgo', 'teacher'),
    ('00000000-0000-4000-8000-000000000103'::uuid, 'tutor@syncut.test', 'Mtra. Fernanda Ruiz', 'tutor'),
    ('00000000-0000-4000-8000-000000000104'::uuid, 'coordinacion@syncut.test', 'Ana Ramos', 'coordinator'),
    ('00000000-0000-4000-8000-000000000105'::uuid, 'admin@syncut.test', 'Admin SyncUT', 'admin')
)
INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, full_name, role_name
FROM demo_users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    updated_at = now();

INSERT INTO public.role_permissions (role, permission, description)
VALUES
  ('student', 'justifications:create', 'Crear y consultar justificaciones propias'),
  ('student', 'appointments:create', 'Solicitar citas con tutor asignado'),
  ('student', 'incidents:create', 'Reportar incidencias propias'),
  ('teacher', 'justifications:review', 'Revisar contexto academico de justificaciones'),
  ('teacher', 'incidents:manage', 'Atender incidencias academicas asignadas'),
  ('tutor', 'appointments:manage', 'Gestionar agenda, citas y seguimiento tutorial'),
  ('tutor', 'justifications:review', 'Revisar solicitudes de estudiantes asignados'),
  ('coordinator', 'operations:manage', 'Supervisar flujo, reasignaciones y escalamiento'),
  ('coordinator', 'chatbot:manage', 'Administrar contenidos del chatbot'),
  ('admin', 'governance:view', 'Acceso a gobierno, auditoria y tablero ejecutivo'),
  ('admin', 'roles:manage', 'Asignar roles con auditoria')
ON CONFLICT (role, permission) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO public.students (id, student_code, cohort, career, status, enrollment_date, expected_graduation)
VALUES (
  '00000000-0000-4000-8000-000000000101',
  'SYNCUT-EST-001',
  '2026-A',
  'Ingenieria en Desarrollo de Software',
  'active',
  '2026-01-15',
  '2028-12-15'
)
ON CONFLICT (id) DO UPDATE
SET student_code = EXCLUDED.student_code,
    cohort = EXCLUDED.cohort,
    career = EXCLUDED.career,
    status = EXCLUDED.status,
    expected_graduation = EXCLUDED.expected_graduation,
    updated_at = now();

INSERT INTO public.teachers (id, employee_code, department, specialization, availability_hours, office_location)
VALUES
  (
    '00000000-0000-4000-8000-000000000102',
    'SYNCUT-DOC-001',
    'Ciencias Basicas',
    ARRAY['Calculo Integral', 'Fisica II'],
    '{"monday":"09:00-13:00","wednesday":"10:00-14:00"}'::jsonb,
    'Edificio B-204'
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    'SYNCUT-TUT-001',
    'Tutoria Academica',
    ARRAY['Acompanamiento estudiantil', 'Seguimiento academico'],
    '{"tuesday":"09:00-12:00","thursday":"13:00-16:00"}'::jsonb,
    'Tutoria A-102'
  )
ON CONFLICT (id) DO UPDATE
SET employee_code = EXCLUDED.employee_code,
    department = EXCLUDED.department,
    specialization = EXCLUDED.specialization,
    availability_hours = EXCLUDED.availability_hours,
    office_location = EXCLUDED.office_location,
    updated_at = now();

INSERT INTO public.tutorship_assignments (tutor_id, student_id, assigned_date, status)
VALUES (
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000101',
  '2026-07-01',
  'active'
)
ON CONFLICT (tutor_id, student_id) DO UPDATE
SET status = EXCLUDED.status;

INSERT INTO public.attendance_records (student_id, subject_name, record_date, status)
VALUES
  ('00000000-0000-4000-8000-000000000101', 'Calculo Integral', '2026-07-01', 'absent'),
  ('00000000-0000-4000-8000-000000000101', 'Fisica II', '2026-07-02', 'tardy')
ON CONFLICT DO NOTHING;

INSERT INTO public.justifications (
  id,
  student_id,
  category,
  title,
  description,
  start_date,
  end_date,
  status,
  reviewer_id,
  review_notes
)
VALUES (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000101',
  'medical',
  'Consulta medica urgente',
  'El estudiante carga evidencia medica para justificar la falta de Calculo Integral.',
  '2026-07-01',
  '2026-07-01',
  'pending',
  '00000000-0000-4000-8000-000000000103',
  'Pendiente de validacion por tutor y coordinacion.'
)
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status,
    reviewer_id = EXCLUDED.reviewer_id,
    review_notes = EXCLUDED.review_notes,
    updated_at = now();

INSERT INTO public.notification_event_types (slug, label, description, channel)
VALUES
  ('justification.created', 'Justificacion creada', 'Aviso cuando una solicitud de justificacion entra al flujo.', 'both'),
  ('appointment.requested', 'Cita solicitada', 'Aviso para tutores cuando un estudiante solicita acompanamiento.', 'both'),
  ('incident.assigned', 'Incidencia asignada', 'Aviso cuando un caso requiere atencion de un responsable.', 'both')
ON CONFLICT (slug) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    channel = EXCLUDED.channel;

INSERT INTO public.notifications (user_id, event_type, title, body, metadata)
VALUES
  (
    '00000000-0000-4000-8000-000000000101',
    'justification.created',
    'Justificacion recibida',
    'Tu solicitud medica fue registrada y quedo pendiente de revision.',
    '{"justification_id":"00000000-0000-4000-8000-000000000201"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    'appointment.requested',
    'Nuevo caso tutorial',
    'Maria Lopez requiere seguimiento por falta justificada y cita tutorial.',
    '{"student_id":"00000000-0000-4000-8000-000000000101"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000104',
    'incident.assigned',
    'Caso escalado a coordinacion',
    'Hay un flujo demo pendiente para supervision institucional.',
    '{"source":"seed-role-workflow"}'::jsonb
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.tutor_availability (id, tutor_id, day_of_week, starts_at, ends_at, modality, location, active)
VALUES
  (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000103',
    2,
    '09:00',
    '12:00',
    'presencial',
    'Tutoria A-102',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000103',
    4,
    '13:00',
    '16:00',
    'virtual',
    'https://meet.syncut.test/tutoria-demo',
    true
  )
ON CONFLICT (id) DO UPDATE
SET day_of_week = EXCLUDED.day_of_week,
    starts_at = EXCLUDED.starts_at,
    ends_at = EXCLUDED.ends_at,
    modality = EXCLUDED.modality,
    location = EXCLUDED.location,
    active = EXCLUDED.active,
    updated_at = now();

INSERT INTO public.appointments (
  id,
  student_id,
  tutor_id,
  scheduled_date,
  starts_at,
  ends_at,
  modality,
  reason,
  status,
  location,
  meeting_url
)
VALUES (
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000103',
  '2026-07-07',
  '09:30',
  '10:00',
  'presencial',
  'Seguimiento por falta justificada y plan de recuperacion academica.',
  'confirmada',
  'Tutoria A-102',
  null
)
ON CONFLICT (id) DO UPDATE
SET scheduled_date = EXCLUDED.scheduled_date,
    starts_at = EXCLUDED.starts_at,
    ends_at = EXCLUDED.ends_at,
    modality = EXCLUDED.modality,
    reason = EXCLUDED.reason,
    status = EXCLUDED.status,
    location = EXCLUDED.location,
    meeting_url = EXCLUDED.meeting_url,
    updated_at = now();

INSERT INTO public.appointment_audit_events (appointment_id, actor_id, event_type, to_status, note)
VALUES (
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000103',
  'created',
  'confirmada',
  'Cita demo confirmada para validar el flujo de tutorias.'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.tutoring_session_notes (appointment_id, author_id, observations, agreements, recommendations)
VALUES (
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000103',
  'Estudiante con justificacion medica pendiente y riesgo bajo de rezago.',
  'Enviar evidencia final y recuperar ejercicio de Calculo Integral.',
  'Programar seguimiento posterior a revision de coordinacion.'
)
ON CONFLICT (appointment_id) DO UPDATE
SET observations = EXCLUDED.observations,
    agreements = EXCLUDED.agreements,
    recommendations = EXCLUDED.recommendations;

INSERT INTO public.incidents (
  id,
  reported_by,
  assigned_to,
  area,
  title,
  description,
  priority,
  status,
  category
)
VALUES (
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000104',
  'Servicios escolares',
  'Documento medico no visible para revision',
  'El estudiante reporta que el comprobante cargado requiere validacion administrativa.',
  'media',
  'en_proceso',
  'administrativa'
)
ON CONFLICT (id) DO UPDATE
SET assigned_to = EXCLUDED.assigned_to,
    area = EXCLUDED.area,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    priority = EXCLUDED.priority,
    status = EXCLUDED.status,
    category = EXCLUDED.category,
    updated_at = now();

INSERT INTO public.incident_comments (incident_id, author_id, content)
VALUES (
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000104',
  'Coordinacion valida el documento y mantiene el caso en seguimiento.'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.incident_audit_events (incident_id, actor_id, event_type, to_status, to_priority, assigned_to, note)
VALUES (
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000104',
  'assigned',
  'en_proceso',
  'media',
  '00000000-0000-4000-8000-000000000104',
  'Caso demo asignado a coordinacion para supervision.'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.chatbot_faq_entries (
  id,
  category,
  question,
  answer,
  keywords,
  priority,
  status,
  source,
  requires_handoff
)
VALUES
  (
    '00000000-0000-4000-8000-000000000601',
    'justificaciones',
    'Como consulto el estado de mi justificacion',
    'Entra al modulo Justificaciones. Ahi veras el folio, estado, vencimiento, evidencias, notas de revision y bitacora completa.',
    ARRAY['justificacion', 'estado', 'folio', 'evidencia'],
    10,
    'published',
    'Seed demo SyncUT',
    false
  ),
  (
    '00000000-0000-4000-8000-000000000602',
    'tutorias',
    'Como agendo una cita con mi tutor',
    'Abre Citas con Tutor, selecciona a tu tutor asignado, elige un horario disponible y registra el motivo de seguimiento.',
    ARRAY['cita', 'tutor', 'agenda', 'horario'],
    20,
    'published',
    'Seed demo SyncUT',
    false
  )
ON CONFLICT (id) DO UPDATE
SET category = EXCLUDED.category,
    question = EXCLUDED.question,
    answer = EXCLUDED.answer,
    keywords = EXCLUDED.keywords,
    priority = EXCLUDED.priority,
    status = EXCLUDED.status,
    source = EXCLUDED.source,
    requires_handoff = EXCLUDED.requires_handoff,
    updated_at = now();
