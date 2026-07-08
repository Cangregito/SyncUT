delete from public.role_permissions
where permission in (
  'justifications:review',
  'appointments:manage',
  'incidents:manage'
);

insert into public.role_permissions (role, permission, description)
values
  ('student', 'dashboard:view', 'Ver panel operativo de estudiante'),
  ('student', 'justifications:create', 'Crear justificaciones propias con evidencia'),
  ('student', 'appointments:create', 'Solicitar citas con tutor asignado'),
  ('student', 'notifications:view', 'Consultar notificaciones propias'),
  ('student', 'incidents:create', 'Reportar incidencias propias'),
  ('student', 'chatbot:use', 'Usar asistente institucional'),

  ('teacher', 'dashboard:view', 'Ver panel operativo docente'),
  ('teacher', 'justifications:academic_note', 'Aportar contexto academico a justificaciones'),
  ('teacher', 'notifications:view', 'Consultar notificaciones propias'),
  ('teacher', 'incidents:comment', 'Comentar incidencias academicas asignadas'),
  ('teacher', 'chatbot:use', 'Usar asistente institucional'),

  ('tutor', 'dashboard:view', 'Ver panel operativo tutorial'),
  ('tutor', 'justifications:tutor_followup', 'Dar seguimiento tutorial y solicitar informacion'),
  ('tutor', 'appointments:availability', 'Publicar disponibilidad tutorial'),
  ('tutor', 'appointments:confirm', 'Confirmar y actualizar citas asignadas'),
  ('tutor', 'appointments:attendance', 'Registrar asistencia de tutorias'),
  ('tutor', 'appointments:session_note', 'Documentar acuerdos de sesiones tutoriales'),
  ('tutor', 'notifications:view', 'Consultar notificaciones propias'),
  ('tutor', 'incidents:comment', 'Comentar incidencias con contexto tutorial'),
  ('tutor', 'chatbot:use', 'Usar asistente institucional'),

  ('coordinator', 'dashboard:view', 'Ver panel operativo de coordinacion'),
  ('coordinator', 'justifications:resolve', 'Aprobar, rechazar o solicitar informacion en justificaciones'),
  ('coordinator', 'appointments:oversight', 'Supervisar agenda tutorial institucional'),
  ('coordinator', 'notifications:view', 'Consultar notificaciones propias'),
  ('coordinator', 'incidents:assign', 'Asignar responsables de incidencias'),
  ('coordinator', 'incidents:resolve', 'Resolver y cerrar incidencias institucionales'),
  ('coordinator', 'chatbot:use', 'Usar asistente institucional'),
  ('coordinator', 'chatbot:manage', 'Administrar base FAQ del asistente'),

  ('admin', 'dashboard:view', 'Ver panel operativo completo'),
  ('admin', 'justifications:create', 'Crear justificaciones en modo administracion'),
  ('admin', 'justifications:academic_note', 'Aportar contexto academico'),
  ('admin', 'justifications:tutor_followup', 'Dar seguimiento tutorial'),
  ('admin', 'justifications:resolve', 'Resolver justificaciones'),
  ('admin', 'appointments:create', 'Crear citas en modo administracion'),
  ('admin', 'appointments:availability', 'Administrar disponibilidad tutorial'),
  ('admin', 'appointments:confirm', 'Actualizar citas'),
  ('admin', 'appointments:attendance', 'Registrar asistencia'),
  ('admin', 'appointments:session_note', 'Documentar sesiones'),
  ('admin', 'appointments:oversight', 'Supervisar agenda completa'),
  ('admin', 'notifications:view', 'Consultar notificaciones'),
  ('admin', 'incidents:create', 'Crear incidencias'),
  ('admin', 'incidents:comment', 'Comentar incidencias'),
  ('admin', 'incidents:assign', 'Asignar incidencias'),
  ('admin', 'incidents:resolve', 'Resolver incidencias'),
  ('admin', 'chatbot:use', 'Usar asistente institucional'),
  ('admin', 'chatbot:manage', 'Administrar base FAQ'),
  ('admin', 'governance:view', 'Gobernar roles, seguridad y auditoria')
on conflict (role, permission) do update
set description = excluded.description;
