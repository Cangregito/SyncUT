# Auditoria funcional modulo por modulo - SyncUT

Fecha: 2026-06-30

## Regla de oro

La plataforma no debe mostrar actividad, usuarios, citas, tramites, incidencias ni metricas que no existan en Supabase. Si una tabla esta vacia o RLS no permite leerla, la interfaz debe mostrar un estado vacio accionable, no datos de ejemplo.

## Fuentes de referencia usadas

- W3C WCAG 2.2: accesibilidad, foco visible, errores de entrada, nombres/labels y mensajes de estado.
- U.S. eCFR 34 CFR Part 99 / FERPA: proteccion de registros educativos e informacion identificable del estudiante.
- U.S. Department of Education Student Privacy: controles de privacidad y manejo de datos estudiantiles.
- OWASP ASVS: autenticacion, autorizacion, gestion de sesion, validacion de entrada y registro de eventos.
- NIST Cybersecurity Framework 2.0 y NIST Privacy Framework: gobierno, proteccion, deteccion, respuesta, minimizacion y trazabilidad.
- Supabase Row Level Security: politicas por tabla, autorizacion desde la base de datos y uso seguro de clientes anon/server.
- NACADA Core Values y referencias de apoyo academico: responsabilidad institucional, documentacion de seguimiento, confidencialidad y atencion centrada en el estudiante.

## Criterios transversales obligatorios

1. Identidad real: todo usuario operativo debe existir en `profiles` y estar asociado a Auth.
2. Roles reales: estudiante, tutor/docente, coordinador y admin deben resolverse desde servidor o RLS, nunca desde cliente.
3. RLS: cada tabla de modulo debe tener politicas de lectura/escritura acordes al rol.
4. Auditoria: cada cambio de estado academico u operativo debe generar evento trazable.
5. Notificaciones: los eventos importantes deben emitir aviso in-app y, cuando aplique, registro en cola de correo.
6. Estados UI: carga, vacio, error, permiso insuficiente y exito deben estar presentes.
7. Accesibilidad: formularios con labels, errores cercanos al campo, foco visible y controles operables por teclado.
8. Privacidad: no exponer datos de estudiantes fuera de su rol; no usar datos sensibles en logs o metadata abierta.
9. Exportacion: reportes CSV/PDF solo desde datos reales y con alcance de rol.
10. No mocks: prohibido `localStorage`, listas semilla y porcentajes inventados en superficie productiva.

## Matriz por modulo

### 1. Autenticacion y perfiles

Debe realizar:
- Login real con Supabase Auth.
- Registro controlado con confirmacion de correo.
- Recuperacion de contrasena funcional.
- Perfil institucional con nombre, correo, telefono opcional y rol.
- Redireccion segura por `next` sin open redirect.
- Cierre de sesion y proteccion de rutas por rol.
- Registro/auditoria de eventos sensibles.

Estado actual:
- Login y signup usan Supabase Auth.
- Rutas dashboard usan `requireProfile` / `requireRole`.
- `profiles` existe en tipos y base.

Brechas:
- Recuperacion de contrasena apunta a `#`.
- Terminos, privacidad y ayuda apuntan a `#`.
- Signup permite autorregistro sin flujo visible de aprobacion institucional/rol.
- Comentario de fuerza de contrasena menciona mockup.

Prioridad: critica.

Siguiente accion tecnica:
- Implementar pantalla/accion de reset password con `resetPasswordForEmail`.
- Crear paginas reales de privacidad, terminos y ayuda institucional.
- Definir si el autorregistro queda como `student` pendiente o requiere aprobacion administrativa.

### 2. Dashboard general del usuario

Debe realizar:
- Mostrar conteos visibles por RLS: citas proximas, tramites pendientes, incidencias abiertas, notificaciones no leidas.
- Mostrar accesos por rol, no todos los modulos indiscriminadamente.
- Mostrar errores de setup/RLS de forma accionable para admin.
- No mostrar metricas globales si el usuario no tiene permiso.

Estado actual:
- Lee conteos reales desde Supabase.
- Usa `requireProfile`.
- Tiene tarjetas de acceso y atencion operativa.

Brechas:
- Falta adaptar accesos por rol.
- Falta desglose temporal: hoy, semana, vencidos.
- Falta panel de tareas personales para tutor/coordinador.

Prioridad: alta.

Siguiente accion tecnica:
- Crear lista "Mis pendientes" por rol: estudiante, tutor, coordinador, admin.

### 3. Citas con tutor

Debe realizar:
- Solicitud de cita por estudiante con tutor asignado o disponible.
- Disponibilidad real del tutor por dia, horario y modalidad.
- Prevencion de colisiones por base de datos.
- Estados: pendiente, confirmada, cancelada, completada.
- Reglas de transicion por rol.
- Notas posteriores: observaciones, acuerdos y recomendaciones.
- Historial/auditoria de cambios.
- Notificaciones por creacion, cambio de estado y nota.
- Filtros por estado, tutor, estudiante, fecha y modalidad.

Estado actual:
- Usa `appointments`, `tutor_availability`, `appointment_audit_events` y `tutoring_session_notes`.
- Valida disponibilidad y transiciones.
- Emite notificaciones via RPC.
- Usa `appointment_attendance` para registrar asistencia, no-show o ausencia justificada, con auditoria y notificacion.
- Compila y build pasa.

Brechas:
- Falta calendario visual/agenda semanal.
- Falta reprogramacion formal con motivo.
- Falta bloqueo por ventana minima de cancelacion si la institucion lo requiere.

Prioridad: alta.

Siguiente accion tecnica:
- Agregar flujo de reprogramacion formal con motivo, aprobacion y notificacion.

### 4. Justificaciones

Debe realizar:
- Crear solicitud con categoria, periodo, descripcion y evidencias.
- Validar archivos permitidos y tamano.
- Revisar por coordinador/admin con estados: pendiente, aprobada, rechazada, requiere informacion.
- Mantener historial de revision.
- Permitir agregar evidencia adicional cuando se solicite.
- Notificar a estudiante y revisor.
- Generar vista de vencidas/en revision.

Estado actual:
- Usa `justifications`, `justification_files`, bucket de evidencias y `justification_audit_events`.
- Soporta revision y evidencias firmadas.
- Emite notificaciones.
- Genera folio institucional, fecha de envio y vencimiento desde campos persistidos en Supabase.

Brechas:
- Falta clasificacion de evidencia por tipo/documento.
- Falta exportacion o folio imprimible.
- Falta validacion de antivirus/OCR si se vuelve requisito.

Prioridad: alta.

Siguiente accion tecnica:
- Agregar exportacion o folio imprimible con alcance de rol.

### 5. Notificaciones

Debe realizar:
- Bandeja in-app por usuario.
- Preferencias por tipo de evento y canal.
- Logs de emision.
- Cola de correo con reintentos y estados.
- Marcar una/todas como leidas.
- Integracion con eventos reales de todos los modulos.
- Plantillas por evento y metadata minima.

Estado actual:
- Usa `notifications`, `notification_preferences`, `notification_event_types`, `notification_logs` y `email_queue`.
- Existe RPC `emit_notification`.
- Modulos principales ya llaman la RPC.
- Existe RPC `get_email_queue_summary()` para que admin/coordinador vean estado agregado de la cola sin exponer filas protegidas por RLS.
- Existe Edge Function desplegada `process-email-queue` para procesar la cola con service role, Resend y reintentos.

Brechas:
- Falta plantilla visual de correo por evento.
- Falta configurar secretos de produccion: `RESEND_API_KEY`, `EMAIL_FROM` y `EMAIL_QUEUE_TRIGGER_TOKEN`.
- Falta programar el invocador periodico de la Edge Function con el token.

Prioridad: critica.

Siguiente accion tecnica:
- Configurar secretos reales de Supabase Functions y programar ejecucion periodica segura del procesador.

### 6. Incidencias

Debe realizar:
- Crear reporte con categoria, area, prioridad y descripcion.
- Asignar responsable.
- Calcular SLA por prioridad.
- Estados: abierta, en proceso, resuelta, cerrada.
- Comentarios de seguimiento.
- Resumen obligatorio para resolver/cerrar.
- Historial/auditoria completo.
- Notificaciones por asignacion, comentario, resolucion y cierre.
- Filtros por estado, prioridad, categoria, SLA y responsable.

Estado actual:
- Migracion aplicada: categoria, SLA, respuesta inicial, resumen y auditoria.
- Pagina usa datos reales y acciones de servidor.
- Build y typecheck pasan.

Brechas:
- Falta dashboard compacto de SLA por responsable.
- Falta escalamiento automatico cuando vence SLA.
- Falta adjuntos/evidencia para incidencias si la institucion lo requiere.

Prioridad: alta.

Siguiente accion tecnica:
- Agregar escalamiento automatico o manual con evento de auditoria.

### 7. Chatbot / Centro de ayuda

Debe realizar:
- Base FAQ oficial aprobada por admin/coordinador.
- Busqueda por palabras clave.
- Conversaciones persistentes.
- Mensajes con origen usuario/asistente/agente.
- Feedback del usuario.
- Escalacion a humano con prioridad y razon.
- Trazabilidad de handoff.
- No prometer IA generativa si no hay motor conectado.

Estado actual:
- Usa `chatbot_conversations`, `chatbot_messages`, `chatbot_faq_entries`, `chatbot_feedback` y `chatbot_handoffs`.
- Admin/coordinador pueden crear FAQ.
- Emite notificacion de escalacion.

Brechas:
- Falta motor de ranking/busqueda mejorado por similitud o full text.
- Falta panel de agente para resolver handoffs.
- Falta cierre de conversacion y medicion de satisfaccion por flujo.

Prioridad: media-alta.

Siguiente accion tecnica:
- Crear panel de handoffs para staff con asignacion, respuesta y cierre.

### 8. Admin / Dashboard ejecutivo

Debe realizar:
- Mostrar salud operativa real por modulo.
- Mostrar actividad/auditoria real.
- Separar metricas de codigo de metricas academicas.
- Exportar reportes reales.
- Respetar RLS y no filtrar datos sensibles.
- Mostrar colas, pendientes, SLA y errores de integracion.

Estado actual:
- Dashboard ejecutivo ya lee Supabase para salud operacional.
- Git/GitHub se mantiene como fuente real de codigo.
- Exporta CSV desde actividad/KPI en pantalla.

Brechas:
- Persisten secciones declarativas de roadmap, riesgos e integrantes en `data.ts`.
- Falta separar "gobernanza tecnica" de "operacion academica".
- Falta vista de permisos/RLS por tabla para admin.

Prioridad: media.

Siguiente accion tecnica:
- Mover roadmap/riesgos a tablas reales o retirar secciones declarativas de produccion.

## Orden recomendado de desarrollo

1. Autenticacion: reset password, paginas legales/ayuda y politica de autorregistro.
2. Notificaciones: procesador real de `email_queue`.
3. Citas: reprogramacion, no-show y seguimiento de acuerdos.
4. Justificaciones: folio, vencimiento y filtros de vencidas.
5. Incidencias: escalamiento SLA.
6. Chatbot: panel de handoffs para staff.
7. Dashboard: eliminar roadmap/riesgos declarativos o persistirlos en Supabase.

## Evidencia de verificacion actual

- `pnpm --filter web typecheck`: correcto en la ultima verificacion.
- `pnpm --filter web lint`: correcto, con warning existente de fuente en `app/layout.tsx`.
- `pnpm --filter web build`: correcto en la ultima verificacion.

## Referencias

- https://www.w3.org/TR/WCAG22/
- https://www.ecfr.gov/current/title-34/subtitle-A/part-99
- https://studentprivacy.ed.gov/
- https://owasp.org/www-project-application-security-verification-standard/
- https://www.nist.gov/cyberframework
- https://www.nist.gov/privacy-framework
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://nacada.ksu.edu/Resources/Pillars/CoreValues.aspx
