# Auditoria de roles y flujo real

Fecha: 2026-07-06  
Produccion: https://syncut.click
Commit base documentado: `d125611 feat: separate role workflows`

## Objetivo

Validar que los roles de SyncUT no sean solo botones o menus distintos, sino un flujo real de trabajo con responsabilidades separadas para estudiante, docente, tutor, coordinacion y administrador.

El problema detectado era que varios roles compartian permisos genericos como `justifications:review`, `appointments:manage` e `incidents:manage`. Eso hacia que docente, tutor y coordinacion pudieran operar casi igual, aunque en un flujo institucional real tienen funciones distintas.

## Cuentas demo

Todas usan la contrasena:

```text
SyncUT2026!
```

| Rol | Correo | Proposito de prueba |
| --- | --- | --- |
| Estudiante | `estudiante@syncut.test` | Crear solicitudes y dar seguimiento a casos propios. |
| Docente | `docente@syncut.test` | Aportar contexto academico y evidencia docente. |
| Tutor | `tutor@syncut.test` | Mtra. Fernanda Ruiz Hernandez; gestiona tutorias, asistencia y seguimiento tutorial. |
| Coordinacion | `coordinacion@syncut.test` | Resolver expedientes y asignar responsables. |
| Administrador | `admin@syncut.test` | Gobernanza, auditoria y supervision completa. |

## Modelo real por rol

### Estudiante

Responsabilidad principal: iniciar el flujo.

Puede:
- Crear justificaciones propias con evidencia.
- Solicitar citas con su tutor asignado.
- Reportar incidencias propias.
- Consultar notificaciones.
- Usar el chatbot institucional.

No puede:
- Aprobar o rechazar justificaciones.
- Crear disponibilidad de tutoria.
- Asignar o resolver incidencias.
- Administrar FAQ, roles o gobierno de la plataforma.

### Docente

Responsabilidad principal: aportar contexto academico, no decidir el caso.

Puede:
- Ver justificaciones visibles y agregar notas academicas.
- Comentar incidencias academicas asignadas o visibles por RLS.
- Consultar notificaciones.
- Usar el chatbot.

No puede:
- Aprobar o rechazar justificaciones.
- Solicitar informacion formal al estudiante.
- Crear disponibilidad de tutoria.
- Confirmar, completar o registrar asistencia de citas.
- Asignar o resolver incidencias.

### Tutor

Responsabilidad principal: acompanamiento tutorial.

Puede:
- Publicar disponibilidad de tutorias.
- Confirmar, cancelar o completar citas asignadas.
- Registrar asistencia.
- Documentar observaciones, acuerdos y recomendaciones de la sesion.
- Dar seguimiento tutorial en justificaciones.
- Solicitar informacion adicional en justificaciones.
- Comentar incidencias con contexto tutorial.

No puede:
- Aprobar o rechazar justificaciones como resolucion institucional.
- Asignar responsables de incidencias.
- Resolver o cerrar incidencias institucionales.
- Gobernar roles o seguridad.

### Coordinacion

Responsabilidad principal: decision institucional y supervision operativa.

Puede:
- Aprobar, rechazar o solicitar informacion en justificaciones.
- Supervisar agenda tutorial.
- Desactivar bloques de disponibilidad cuando sea necesario.
- Asignar responsables de incidencias.
- Resolver y cerrar incidencias.
- Administrar la base FAQ del chatbot.
- Consultar notificaciones.

No puede:
- Reemplazar el flujo de estudiante para crear solicitudes personales.
- Actuar como tutor dueño de disponibilidad propia.
- Gobernar roles de administracion global.

### Administrador

Responsabilidad principal: gobierno completo del sistema.

Puede:
- Acceder al panel de gobernanza.
- Revisar salud de modulos, datos y auditoria.
- Ver y operar permisos administrativos.
- Administrar FAQ, incidencias, citas, justificaciones y notificaciones.

Debe usarse para:
- Validaciones tecnicas.
- Auditoria.
- Diagnostico de produccion.
- Operaciones maestras.

## Permisos refinados

Se eliminaron los permisos genericos:

```text
justifications:review
appointments:manage
incidents:manage
```

Se reemplazaron por permisos orientados a responsabilidad:

| Modulo | Permisos nuevos |
| --- | --- |
| Dashboard | `dashboard:view` |
| Justificaciones | `justifications:create`, `justifications:academic_note`, `justifications:tutor_followup`, `justifications:resolve` |
| Citas | `appointments:create`, `appointments:availability`, `appointments:confirm`, `appointments:attendance`, `appointments:session_note`, `appointments:oversight` |
| Notificaciones | `notifications:view` |
| Incidencias | `incidents:create`, `incidents:comment`, `incidents:assign`, `incidents:resolve` |
| Chatbot | `chatbot:use`, `chatbot:manage` |
| Gobernanza | `governance:view` |

## Flujo por modulo

### Justificaciones

1. El estudiante crea una justificacion con fecha, motivo y evidencia.
2. El docente agrega contexto academico si aplica.
3. El tutor da seguimiento y puede solicitar informacion adicional.
4. Coordinacion aprueba, rechaza o solicita informacion formal.
5. El sistema registra bitacora y notificaciones.

Guards aplicados:
- `createJustification`: solo estudiante.
- `addReviewNote`: docente, tutor, coordinacion o admin segun permiso.
- `updateJustificationStatus`: coordinacion/admin para resolver; tutor solo para solicitar informacion.

### Citas con tutor

1. El tutor publica disponibilidad.
2. El estudiante solicita cita con tutor asignado.
3. El tutor confirma o cancela la cita asignada.
4. El tutor registra asistencia.
5. El tutor documenta seguimiento de sesion.
6. Coordinacion supervisa agenda y puede intervenir operativamente.

Guards aplicados:
- `createAppointment`: solo estudiante.
- `createAvailability`: solo tutor.
- `updateAppointmentStatus`: estudiante solo cancela cita propia; tutor opera citas asignadas; coordinacion/admin supervisan.
- `recordAttendance`: tutor asignado o coordinacion/admin.
- `createSessionNote`: tutor asignado o coordinacion/admin.
- `deactivateAvailability`: tutor dueno del bloque o coordinacion/admin.

### Incidencias

1. El estudiante reporta una incidencia.
2. Coordinacion asigna responsable.
3. Docente o tutor comentan segun el tipo de caso y visibilidad.
4. Coordinacion resuelve o cierra.
5. Admin conserva visibilidad y control superior.

Guards aplicados:
- `createIncident`: solo estudiante.
- `assignIncident`: coordinacion/admin.
- `updateIncidentStatus`: coordinacion/admin.
- `createIncidentComment`: reportante, docente/tutor con permiso de comentario, coordinacion/admin.
- `PATCH /api/incidencias/[id]`: solo roles con `incidents:resolve`.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `apps/web/lib/auth/roles.ts` | Modelo granular de permisos y modulos visibles por rol. |
| `apps/web/lib/auth/roles.test.ts` | Pruebas para evitar regresion de permisos genericos. |
| `apps/web/app/(dashboard)/dashboard/page.tsx` | Textos de flujo por rol y etiquetas de permisos nuevas. |
| `apps/web/app/(dashboard)/justificaciones/page.tsx` | UI y guards de servidor separados por rol real. |
| `apps/web/app/(dashboard)/citas/page.tsx` | Flujo estudiante/tutor/coordinacion separado. |
| `apps/web/app/(dashboard)/incidencias/page.tsx` | Flujo reporta/asigna/comenta/resuelve separado. |
| `apps/web/app/api/incidencias/[id]/route.ts` | API PATCH restringido a coordinacion/admin. |
| `supabase/migrations/20260706000003_refine_role_workflow_permissions.sql` | Migracion de permisos institucionales refinados. |

## Verificacion realizada

Comandos ejecutados:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm db:push
```

Resultado:
- TypeScript correcto.
- Tests correctos.
- Build de Next.js correcto.
- Migracion aplicada en Supabase remoto.
- Commit enviado a `main`.
- Vercel quedo en estado `Ready`.

## Checklist para probar en produccion

1. Iniciar sesion como `estudiante@syncut.test`.
2. Confirmar que puede crear justificacion, cita e incidencia.
3. Iniciar sesion como `docente@syncut.test`.
4. Confirmar que no ve acciones de aprobacion/rechazo ni agenda tutorial, solo notas/contexto.
5. Iniciar sesion como `tutor@syncut.test`.
6. Confirmar que puede publicar disponibilidad, confirmar citas, registrar asistencia y pedir informacion en justificaciones.
7. Iniciar sesion como `coordinacion@syncut.test`.
8. Confirmar que puede resolver justificaciones, asignar incidencias y cerrar casos.
9. Iniciar sesion como `admin@syncut.test`.
10. Confirmar acceso a gobernanza y supervision completa.

## Conclusion

El sistema ya muestra un flujo real por rol. Los roles dejan de ser decorativos porque cada uno opera una etapa distinta del proceso institucional:

- Estudiante inicia.
- Docente valida contexto.
- Tutor acompana.
- Coordinacion decide y asigna.
- Administrador gobierna.
