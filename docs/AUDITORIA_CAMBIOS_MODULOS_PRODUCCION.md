# Auditoria de cambios por modulo - Produccion SyncUT

Fecha: 2026-06-30

## Despliegue a produccion

La aplicacion web fue desplegada a Vercel en produccion.

- URL principal: https://sync-ut.vercel.app
- URL del deployment: https://sync-m5hbb50df-cangregitos-projects.vercel.app
- Deployment ID: `dpl_35CKBwas4TumnUwzTPnUm5RFxE4z`
- Proyecto Vercel: `cangregitos-projects/sync-ut`
- Estado: `READY`

Verificacion ejecutada antes del despliegue:

- `pnpm --filter web typecheck`: correcto.
- `pnpm --filter web lint`: correcto, con warning existente de fuente en `app/layout.tsx`.
- `pnpm --filter web build`: correcto.
- `vercel --prod --yes`: deployment productivo correcto.

## Regla aplicada

Todos los modulos trabajados se movieron hacia datos reales desde Supabase. No se deben usar datos ficticios, `localStorage`, listas de ejemplo ni porcentajes inventados para simular operacion. Cuando no hay registros reales, la interfaz muestra estados vacios o errores accionables.

## Modulo de Autenticacion

Mi modulo de autenticacion trabajo el acceso real de usuarios con Supabase Auth.

Que se hizo:

- Login real con `supabase.auth.signInWithPassword`.
- Registro real con `supabase.auth.signUp`.
- Redireccion segura usando parametro `next` validado.
- Nueva pantalla `/forgot-password`.
- Nueva pantalla `/reset-password`.
- El enlace "Olvidaste tu contrasena" ya no apunta a `#`; ahora abre un flujo funcional.
- Limpieza de referencia a mockup en signup.

Como funciona:

- El usuario entra por `/login`.
- Si olvida su contrasena, entra a `/forgot-password`.
- Supabase envia el correo de recuperacion.
- El callback `/auth/callback?next=/reset-password` crea sesion temporal segura.
- En `/reset-password`, el usuario actualiza su contrasena con `supabase.auth.updateUser`.

Estado:

- Funcional en produccion.
- Pendiente: crear paginas reales de privacidad, terminos y ayuda.

## Modulo de Dashboard General

Mi modulo de dashboard trabajo como panel real de operacion por usuario.

Que se hizo:

- El dashboard consulta Supabase desde servidor.
- Muestra conteos reales de estudiantes, docentes, justificaciones pendientes, citas proximas, notificaciones no leidas, incidencias activas y conversaciones activas.
- Usa `requireProfile` para trabajar con el usuario autenticado.

Como funciona:

- Al entrar a `/dashboard`, el sistema identifica el perfil.
- Consulta tablas reales visibles por RLS.
- Si una tabla no esta disponible o no tiene registros, muestra conteos reales o mensajes de estado, no datos inventados.

Estado:

- Funcional en produccion.
- Pendiente: personalizar accesos y pendientes por rol.

## Modulo de Citas con Tutor

Mi modulo de citas trabajo la agenda real de tutorias.

Que se hizo:

- Tabla real `appointments`.
- Tabla real `tutor_availability`.
- Tabla real `appointment_audit_events`.
- Tabla real `tutoring_session_notes`.
- Nueva tabla real `appointment_attendance`.
- Nuevo estado `no_asistio`.
- Registro de asistencia: asistio, no asistio o ausencia justificada.
- Validacion de disponibilidad del tutor.
- Prevencion de horarios invalidos.
- Auditoria de cambios de estado.
- Notificaciones reales por creacion, cambio de estado, nota y asistencia.

Como funciona:

- El tutor registra disponibilidad.
- El estudiante agenda con su tutor asignado.
- La cita queda en estado pendiente.
- Staff puede confirmar, completar, cancelar o registrar no asistencia.
- Al completar, se puede capturar seguimiento con observaciones, acuerdos y recomendaciones.
- Cada cambio queda en bitacora y emite notificacion.

Tablas principales:

- `appointments`
- `tutor_availability`
- `appointment_audit_events`
- `tutoring_session_notes`
- `appointment_attendance`
- `notification_logs`
- `notifications`

Estado:

- Funcional en produccion.
- Pendiente: flujo formal de reprogramacion con motivo y aprobacion.

## Modulo de Justificaciones

Mi modulo de justificaciones trabajo la gestion real de tramites de faltas.

Que se hizo:

- Tabla real `justifications`.
- Tabla real `justification_files`.
- Tabla real `justification_audit_events`.
- Uso del bucket `evidencias_justificaciones`.
- Folio institucional por tramite.
- Fecha de envio `submitted_at`.
- Fecha limite `due_date`.
- Filtro de solicitudes vencidas.
- Revision por admin/coordinador.
- Estados: pendiente, aprobada, rechazada, requiere informacion.
- Evidencias firmadas con URL temporal.
- Notificaciones reales por envio, aprobacion, rechazo, solicitud de mas informacion y evidencia agregada.

Como funciona:

- El estudiante crea una solicitud con categoria, fechas, descripcion y evidencia.
- El sistema genera folio y vencimiento.
- El archivo se guarda en Supabase Storage.
- El coordinador o admin revisa la solicitud.
- Si falta informacion, el estudiante puede subir mas evidencia.
- Cada cambio queda en auditoria.

Tablas principales:

- `justifications`
- `justification_files`
- `justification_audit_events`
- `notifications`
- `notification_logs`

Estado:

- Funcional en produccion.
- Pendiente: folio imprimible/exportable y clasificacion mas detallada de evidencia.

## Modulo de Notificaciones

Mi modulo de notificaciones trabajo el centro real de avisos y la cola de correo.

Que se hizo:

- Bandeja real con `notifications`.
- Preferencias reales por evento con `notification_preferences`.
- Catalogo real con `notification_event_types`.
- Bitacora real con `notification_logs`.
- Cola real con `email_queue`.
- RPC `emit_notification` para que otros modulos generen avisos.
- RPC `get_email_queue_summary()` para admin/coordinador.
- Edge Function `process-email-queue` desplegada en Supabase.
- Vista de resumen de cola en `/notificaciones` para roles autorizados.

Como funciona:

- Los modulos productores llaman `emit_notification`.
- La RPC inserta notificacion in-app y, si aplica, fila en `email_queue`.
- El usuario ve su bandeja y preferencias.
- Admin/coordinador ven resumen agregado de la cola.
- La Edge Function procesa correos reales con Resend cuando existan secretos configurados.
- Si falta `RESEND_API_KEY`, el sistema no finge envio: marca error real en la cola.

Tablas y funciones principales:

- `notifications`
- `notification_preferences`
- `notification_event_types`
- `notification_logs`
- `email_queue`
- `emit_notification`
- `get_email_queue_summary`
- Edge Function: `process-email-queue`

Estado:

- Funcional en produccion para in-app.
- Edge Function desplegada.
- Pendiente operativo: configurar `RESEND_API_KEY`, `EMAIL_FROM` y `EMAIL_QUEUE_TRIGGER_TOKEN`.

## Modulo de Incidencias

Mi modulo de incidencias trabajo el seguimiento real de reportes operativos.

Que se hizo:

- Tabla real `incidents`.
- Tabla real `incident_comments`.
- Nueva tabla `incident_audit_events`.
- Categoria de incidencia.
- SLA por prioridad.
- Fecha de primera respuesta.
- Asignacion de responsable.
- Resolucion con resumen obligatorio.
- Cierre formal.
- Comentarios de seguimiento.
- Notificaciones por creacion, asignacion, comentario, resolucion y cierre.

Como funciona:

- Un usuario crea una incidencia con area, categoria, prioridad y descripcion.
- El sistema calcula vencimiento SLA.
- Staff asigna responsable.
- Se pueden agregar comentarios.
- Para resolver o cerrar, se exige resumen.
- Todo queda auditado.

Tablas principales:

- `incidents`
- `incident_comments`
- `incident_audit_events`
- `notifications`
- `notification_logs`

Estado:

- Funcional en produccion.
- Pendiente: escalamiento automatico/manual cuando vence SLA.

## Modulo de Chatbot / Centro de Ayuda

Mi modulo de chatbot trabajo conversaciones reales y base FAQ oficial.

Que se hizo:

- Tabla real `chatbot_conversations`.
- Tabla real `chatbot_messages`.
- Tabla real `chatbot_faq_entries`.
- Tabla real `chatbot_feedback`.
- Tabla real `chatbot_handoffs`.
- Creacion de preguntas frecuentes por admin/coordinador.
- Conversaciones persistentes.
- Feedback del usuario.
- Escalacion a humano con notificacion.

Como funciona:

- El usuario abre una conversacion.
- El sistema guarda mensajes reales.
- La FAQ oficial sirve como base de respuesta.
- Si el usuario necesita ayuda humana, se crea handoff.
- El handoff emite notificacion al personal.

Tablas principales:

- `chatbot_conversations`
- `chatbot_messages`
- `chatbot_faq_entries`
- `chatbot_feedback`
- `chatbot_handoffs`

Estado:

- Funcional en produccion como centro FAQ/conversaciones.
- Pendiente: panel de agentes para resolver handoffs y cierre operativo de conversaciones.

## Modulo Admin / Dashboard Ejecutivo

Mi modulo admin trabajo el tablero ejecutivo con datos reales de operacion.

Que se hizo:

- `/admin` protegido con `requireRole(["admin"])`.
- El dashboard ejecutivo ahora consulta Supabase para salud operativa.
- Se separan metricas reales de codigo y metricas operativas.
- Consulta conteos reales de citas, justificaciones, incidencias, notificaciones, cola de correo y chatbot.
- Exportacion CSV desde la actividad/KPI visible.

Como funciona:

- Admin entra a `/admin`.
- El sistema carga datos vivos desde Supabase.
- Si Supabase no esta disponible o RLS no permite lectura, muestra estado real de conexion.
- Las metricas de Git/GitHub se generan por script de build.

Tablas principales:

- `profiles`
- `audit_logs`
- `appointments`
- `justifications`
- `incidents`
- `notifications`
- `email_queue`
- `chatbot_conversations`
- `chatbot_handoffs`

Estado:

- Funcional en produccion.
- Pendiente: convertir roadmap/riesgos declarativos de `data.ts` a tablas reales o retirarlos de la vista productiva.

## Base de datos y Supabase

Mi capa de base de datos trabajo la estructura real que sostiene los modulos.

Migraciones nuevas aplicadas:

- `20260628000001_create_tutoring_appointments.sql`
- `20260628000002_create_chatbot_module.sql`
- `20260628000003_enhance_appointments_workflow.sql`
- `20260628000004_enhance_justifications_workflow.sql`
- `20260629000001_create_notification_emitter.sql`
- `20260629000002_enhance_incidents_workflow.sql`
- `20260630000001_create_email_queue_operations.sql`
- `20260630000002_add_appointment_attendance.sql`
- `20260630000003_add_justification_folio_due_date.sql`

Funciones Supabase relevantes:

- `emit_notification`
- `get_email_queue_summary`
- Edge Function `process-email-queue`

Estado:

- Migraciones aplicadas al proyecto Supabase `vvbzhrxfshillhkyunje`.
- Tipos regenerados en `packages/types/src/database.types.ts`.
- Edge Function de correo desplegada.

## Riesgos y pendientes reales

1. Falta configurar secretos reales de correo en Supabase Functions:
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `EMAIL_QUEUE_TRIGGER_TOKEN`

2. Falta programar ejecucion periodica segura de `process-email-queue`.

3. Falta terminar paginas legales:
   - Terminos
   - Privacidad
   - Ayuda

4. Falta convertir secciones declarativas del dashboard ejecutivo a tablas reales:
   - Roadmap
   - Riesgos
   - Integrantes/squads

5. Falta crear flujos avanzados:
   - Reprogramacion formal de citas.
   - Escalamiento de incidencias vencidas.
   - Panel de agentes para handoffs del chatbot.

## Resumen ejecutivo

La plataforma ya no esta funcionando como maqueta visual. Los modulos principales tienen lectura y escritura real contra Supabase, reglas RLS, auditoria, notificaciones y despliegue productivo en Vercel. Lo pendiente ya no es convertir mockups a datos reales; lo pendiente es completar automatizaciones operativas y configuracion de secretos productivos.
