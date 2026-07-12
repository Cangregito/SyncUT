# Guia para equipos: modulos y funcionamiento actual de SyncUT

Fecha de corte: 2026-07-06  
Produccion: https://syncut.click  
Stack actual: Next.js App Router, TypeScript, Supabase Auth/PostgreSQL/Storage/Edge Functions, Vercel, pnpm/Turborepo.

## 1. Resumen corto para abrir la presentacion

SyncUT ya funciona como una plataforma universitaria modular, no solo como mockup. La app tiene autenticacion real con Supabase, rutas protegidas, perfiles por rol, modulos conectados a tablas reales, reglas RLS, bitacoras de auditoria, notificaciones internas y despliegue productivo en Vercel.

Los roles ya no son solo menus diferentes. Cada rol tiene permisos y responsabilidades separadas:

| Rol | Que hace actualmente |
| --- | --- |
| Estudiante | Inicia procesos: crea justificaciones, solicita citas, reporta incidencias, consulta notificaciones y usa el chatbot. |
| Docente | Aporta contexto academico y comentarios, pero no aprueba ni resuelve casos institucionales. |
| Tutor | Gestiona tutorias: disponibilidad, citas, asistencia, seguimiento y apoyo tutorial. |
| Coordinacion | Decide y supervisa: resuelve justificaciones, asigna/resuelve incidencias y administra FAQ. |
| Administrador | Gobierna la plataforma: auditoria, salud de modulos, datos, permisos y supervision completa. |

## 2. Como funciona la app ahora mismo

1. El usuario entra por `/login`.
2. Supabase Auth valida correo y contrasena.
3. La app carga el perfil desde `profiles`.
4. Segun el `role`, se muestran solo los modulos permitidos.
5. Cada modulo lee y escribe datos reales en Supabase.
6. Las operaciones importantes crean auditoria y notificaciones.
7. Las reglas RLS de Supabase limitan lo que cada usuario puede ver o modificar.
8. Admin y coordinacion tienen vistas de supervision mas amplias.

Rutas principales:

| Ruta | Funcion |
| --- | --- |
| `/login` | Inicio de sesion real con Supabase. |
| `/signup` | Registro de usuario con metadata de perfil. |
| `/forgot-password` | Solicitud de recuperacion de contrasena. |
| `/reset-password` | Cambio de contrasena despues del callback seguro. |
| `/dashboard` | Panel principal con resumen operativo y accesos por rol. |
| `/justificaciones` | Gestion de justificaciones academicas. |
| `/citas` | Agenda y seguimiento de citas con tutor. |
| `/notificaciones` | Bandeja de avisos y preferencias. |
| `/incidencias` | Reportes, asignacion, comentarios y cierre de incidencias. |
| `/chatbot` | Centro FAQ, conversaciones y escalamiento a humano. |
| `/admin` | Panel ejecutivo/gobernanza para administrador. |

## 3. Lo que dira cada equipo

### Staff / Plataforma Core

Nuestro equipo sostiene la base tecnica de SyncUT.

Actualmente la plataforma usa un monorepo con `apps/web` para la app Next.js y paquetes compartidos para tipos, SDK, UI y validaciones. La autenticacion, perfiles, roles, proteccion de rutas, contratos de datos y configuracion de despliegue ya estan integrados.

Tambien tenemos produccion en Vercel y Supabase como backend principal. El objetivo del core es que cada squad trabaje su modulo sin romper seguridad, roles ni datos compartidos.

Puntos clave para decir:

- La app esta desplegada en produccion.
- El acceso se controla por Supabase Auth.
- Los perfiles viven en `profiles`.
- Los permisos se administran por rol.
- Las rutas del dashboard se muestran segun permisos.
- Supabase RLS protege la capa de datos.

### Equipo 2 - Autenticacion, roles y auditoria

Nuestro equipo se encarga de identidad, roles, permisos y trazabilidad.

Actualmente el login, registro, recuperacion y cambio de contrasena funcionan con Supabase Auth. Cuando un usuario inicia sesion, la app consulta su perfil y determina que modulos puede ver.

El sistema maneja estos roles: estudiante, docente, tutor, coordinacion y administrador. Cada rol tiene permisos granulares, por ejemplo `justifications:create`, `appointments:attendance`, `incidents:resolve` o `governance:view`.

Tambien se mantiene auditoria en tablas como `audit_logs` y en bitacoras especificas de modulo, para registrar acciones importantes.

Puntos clave para decir:

- El usuario no navega libremente: entra a lo que su rol permite.
- Los permisos genericos se reemplazaron por permisos reales por responsabilidad.
- Estudiante inicia, docente aporta contexto, tutor acompana, coordinacion decide y admin gobierna.
- La base de datos tambien protege accesos con RLS.

### Equipo 1 - Justificaciones

Nuestro modulo gestiona justificaciones academicas con evidencia y flujo de revision.

Actualmente el estudiante puede crear una justificacion con categoria, fechas, titulo, descripcion y evidencia. El sistema genera folio, registra fecha de envio y fecha limite. La evidencia se guarda en Supabase Storage y se consulta con URL temporal.

El docente puede agregar contexto academico. El tutor puede dar seguimiento y pedir informacion adicional. Coordinacion o admin pueden aprobar, rechazar o solicitar mas informacion formal.

Cada cambio genera bitacora y notificaciones.

Tablas principales:

| Tabla | Uso |
| --- | --- |
| `justifications` | Solicitud principal de justificacion. |
| `justification_files` | Evidencias asociadas. |
| `justification_audit_events` | Historial de cambios. |
| `notifications` | Avisos al usuario. |
| `notification_logs` | Registro de eventos de notificacion. |

Validaciones actuales:

- Titulo minimo de 5 caracteres.
- Descripcion minimo de 15 caracteres.
- Fecha fin no puede ser menor que fecha inicio.
- Evidencia debe tener nombre y referencia juntos.
- Solo coordinacion/admin resuelven institucionalmente.

Pendiente real:

- Folio imprimible/exportable.
- Clasificacion mas detallada de evidencia.

### Equipo 3 - Citas con Tutor

Nuestro modulo gestiona agenda, disponibilidad, asistencia y seguimiento tutorial.

Actualmente el tutor publica disponibilidad. El estudiante solicita cita con su tutor asignado. La cita queda pendiente y el tutor puede confirmarla, cancelarla, completarla o registrar asistencia. Al completar una cita, el tutor puede capturar observaciones, acuerdos y recomendaciones.

Coordinacion y admin pueden supervisar la agenda e intervenir cuando sea necesario.

Tablas principales:

| Tabla | Uso |
| --- | --- |
| `appointments` | Citas solicitadas. |
| `tutor_availability` | Bloques de disponibilidad del tutor. |
| `appointment_audit_events` | Bitacora de cambios de estado. |
| `appointment_attendance` | Asistencia: asistio, no asistio o ausencia justificada. |
| `tutoring_session_notes` | Seguimiento posterior a la sesion. |
| `notifications` | Avisos por solicitud, cambio, asistencia o nota. |

Validaciones actuales:

- El estudiante solo puede solicitar cita.
- El tutor solo gestiona citas asignadas.
- Se valida que exista disponibilidad.
- Se bloquean horarios invalidos.
- Modalidad presencial exige lugar/aula.
- Modalidad en linea exige URL `http` o `https`.
- No se permite mezclar aula y URL en la misma modalidad.

Pendiente real:

- Flujo formal de reprogramacion con motivo y aprobacion.

### Equipo 4 - Notificaciones

Nuestro modulo conecta a todos los demas modulos mediante avisos internos y cola de correo.

Actualmente existe bandeja real de notificaciones, preferencias por usuario, catalogo de tipos de evento, logs y una cola de email. Los modulos productores llaman la RPC `emit_notification` para generar avisos.

La notificacion in-app ya funciona. La cola de correo y la Edge Function `process-email-queue` estan preparadas para enviar correos con Resend cuando existan los secretos productivos.

Tablas y funciones principales:

| Recurso | Uso |
| --- | --- |
| `notifications` | Bandeja de avisos. |
| `notification_preferences` | Preferencias por usuario/evento. |
| `notification_event_types` | Catalogo de eventos. |
| `notification_logs` | Bitacora de notificaciones. |
| `email_queue` | Cola de correos. |
| `emit_notification` | RPC para crear avisos desde otros modulos. |
| `get_email_queue_summary` | Resumen de cola para admin/coordinacion. |
| `process-email-queue` | Edge Function que procesa correos. |

Pendiente operativo:

- Configurar `RESEND_API_KEY`.
- Configurar `EMAIL_FROM`.
- Configurar `EMAIL_QUEUE_TRIGGER_TOKEN`.
- Programar ejecucion periodica segura de la cola.

### Equipo 5 - Incidencias

Nuestro modulo gestiona reportes operativos y academicos con seguimiento, SLA y resolucion.

Actualmente un usuario puede crear una incidencia con area, categoria, prioridad y descripcion. El sistema calcula vencimiento de SLA. Coordinacion puede asignar responsable, cambiar estado, resolver o cerrar. Docente y tutor pueden comentar segun su visibilidad y permisos.

Para resolver o cerrar, el sistema exige un resumen. Todo queda auditado y emite notificaciones.

Tablas principales:

| Tabla | Uso |
| --- | --- |
| `incidents` | Reporte principal de incidencia. |
| `incident_comments` | Comentarios de seguimiento. |
| `incident_audit_events` | Bitacora de cambios. |
| `notifications` | Avisos por creacion, asignacion, comentario o cierre. |
| `notification_logs` | Registro de notificaciones. |

Validaciones actuales:

- Titulo minimo de 5 caracteres.
- Area minimo de 3 caracteres.
- Descripcion minimo de 15 caracteres.
- Resolver o cerrar exige resumen minimo de 15 caracteres.
- `PATCH /api/incidencias/[id]` solo permite resolver a roles con permiso `incidents:resolve`.

Pendiente real:

- Escalamiento automatico o manual cuando vence el SLA.

### Equipo 6 - Chatbot / Centro de ayuda

Nuestro modulo funciona como centro FAQ y conversaciones persistentes.

Actualmente el usuario puede abrir una conversacion, consultar preguntas frecuentes y dejar mensajes. La FAQ oficial se guarda en base de datos. Si el caso requiere apoyo humano, se crea un handoff y se notifica al personal.

Coordinacion y admin pueden administrar la base FAQ. Los usuarios normales pueden usar el chatbot.

Tablas principales:

| Tabla | Uso |
| --- | --- |
| `chatbot_conversations` | Conversaciones abiertas o historicas. |
| `chatbot_messages` | Mensajes de cada conversacion. |
| `chatbot_faq_entries` | Base oficial de preguntas frecuentes. |
| `chatbot_feedback` | Retroalimentacion del usuario. |
| `chatbot_handoffs` | Escalamientos a humano. |

Pendiente real:

- Panel de agentes para resolver handoffs.
- Cierre operativo completo de conversaciones.

### Admin / Dashboard Ejecutivo

El panel admin muestra salud operativa y supervision global.

Actualmente `/admin` esta protegido para administrador. Consulta datos vivos de Supabase y muestra metricas de citas, justificaciones, incidencias, notificaciones, cola de correo y chatbot. Si una tabla no esta disponible o RLS no permite leer, la pantalla muestra el estado real en vez de inventar datos.

Tambien separa metricas operativas de metricas de codigo/Git generadas por script.

Tablas consultadas:

| Tabla | Uso |
| --- | --- |
| `profiles` | Usuarios y perfiles. |
| `audit_logs` | Actividad global. |
| `appointments` | Salud del modulo citas. |
| `justifications` | Salud del modulo justificaciones. |
| `incidents` | Salud del modulo incidencias. |
| `notifications` | Avisos y pendientes. |
| `email_queue` | Estado de correos. |
| `chatbot_conversations` | Conversaciones activas. |
| `chatbot_handoffs` | Escalamientos abiertos. |

Pendiente real:

- Convertir roadmap, riesgos e integrantes/squads declarativos a tablas reales o retirarlos de la vista productiva.

## 4. Flujo real por rol

### Estudiante

El estudiante inicia la mayoria de procesos. Puede crear justificaciones, solicitar citas, reportar incidencias, leer notificaciones y usar el chatbot.

No puede aprobar, asignar responsables, registrar asistencia, cerrar casos ni administrar roles.

### Docente

El docente aporta contexto academico. Puede agregar notas o comentarios donde tenga visibilidad, pero no toma decisiones institucionales.

No puede aprobar justificaciones, confirmar citas, registrar asistencia ni resolver incidencias.

### Tutor

El tutor acompana al estudiante. Publica disponibilidad, confirma citas, registra asistencia, documenta sesiones y da seguimiento tutorial.

No puede resolver institucionalmente justificaciones ni cerrar incidencias.

### Coordinacion

Coordinacion toma decisiones institucionales. Aprueba o rechaza justificaciones, supervisa agenda, asigna incidencias, resuelve/cierra casos y administra FAQ.

No gobierna toda la plataforma como admin global.

### Administrador

El administrador tiene control completo para diagnostico, auditoria, seguridad y gobierno de la plataforma.

Debe usarse para validar produccion, revisar salud de modulos y supervisar permisos.

## 5. Cuentas demo para pruebas

Todas usan la contrasena:

```text
SyncUT2026!
```

| Rol | Correo |
| --- | --- |
| Estudiante | `estudiante@syncut.test` |
| Docente | `docente@syncut.test` |
| Tutor | `tutor@syncut.test` |
| Coordinacion | `coordinacion@syncut.test` |
| Administrador | `admin@syncut.test` |

## 6. Estado actual resumido

| Modulo | Estado |
| --- | --- |
| Autenticacion | Funcional en produccion con Supabase Auth. |
| Roles/RBAC | Funcional con permisos granulares por rol. |
| Dashboard | Funcional con conteos reales visibles por RLS. |
| Justificaciones | Funcional con evidencia, folio, auditoria y notificaciones. |
| Citas | Funcional con disponibilidad, estados, asistencia y seguimiento. |
| Notificaciones | In-app funcional; cola de email lista pero requiere secretos productivos. |
| Incidencias | Funcional con SLA, asignacion, comentarios, resolucion y auditoria. |
| Chatbot | Funcional como FAQ/conversaciones/handoff; falta panel de agentes. |
| Admin | Funcional para supervision; falta convertir algunas secciones declarativas a datos reales. |

## 7. Pendientes importantes que se deben decir con claridad

1. Configurar secretos reales de correo en Supabase Functions:
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `EMAIL_QUEUE_TRIGGER_TOKEN`
2. Programar la ejecucion periodica segura de `process-email-queue`.
3. Terminar paginas legales:
   - Terminos
   - Privacidad
   - Ayuda
4. Completar flujos avanzados:
   - Reprogramacion formal de citas.
   - Escalamiento de incidencias vencidas.
   - Panel de agentes para handoffs del chatbot.
5. Convertir datos declarativos del dashboard ejecutivo a tablas reales cuando aplique:
   - Roadmap
   - Riesgos
   - Integrantes/squads

## 8. Cierre sugerido para la exposicion

La plataforma ya paso de maqueta a operacion real. Los modulos principales tienen datos reales, permisos por rol, auditoria, validaciones, notificaciones y despliegue productivo.

Lo que falta no es rehacer la app, sino cerrar configuraciones productivas y automatizaciones: correos reales, ejecucion periodica de cola, paginas legales y algunos flujos avanzados de operacion.
