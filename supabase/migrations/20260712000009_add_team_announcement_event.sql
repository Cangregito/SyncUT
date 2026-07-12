INSERT INTO public.notification_event_types (slug, label, description, channel)
VALUES (
  'tutor_team.announcement',
  'Aviso del equipo tutorial',
  'Aviso enviado por el tutor a los alumnos de su equipo',
  'both'
)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  channel = EXCLUDED.channel;
