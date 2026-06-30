# Investigacion: pagina real de tutorias SyncUT

Fecha: 2026-06-28

## Regla de producto

La pagina no debe usar datos ficticios, semillas visuales ni `localStorage` para simular operacion. Cada modulo debe leer y escribir desde Supabase con RLS activo. Cuando no existan registros, la UI debe mostrar estados vacios accionables y no inventar actividad.

## Fuentes revisadas

- Documentacion local: `MASTER.MD`, `docs/PLATFORM_CORE.md`, `docs/squad-3-citas/appointments.md`, `EsquemaDBJustificaciones.md`, `docs/squad-4-notificaciones/squad4_notifications_database.md`.
- W3C WCAG 2.2: una interfaz institucional debe ser perceptible, operable, comprensible y robusta.
- U.S. Department of Education, FERPA: los registros educativos y datos identificables de estudiantes requieren controles de privacidad y acceso.

## Capacidades minimas de una web real de tutorias

1. Autenticacion y rol real: estudiante, tutor/docente, coordinador y admin desde `public.profiles`.
2. Dashboard con conteos reales: estudiantes, docentes, solicitudes pendientes, citas proximas, incidencias abiertas y notificaciones no leidas.
3. Citas de tutorias: solicitud, tutor asignado, fecha, hora, modalidad, motivo, estado, cancelacion/confirmacion/completado y prevencion de choques de horario.
4. Seguimiento posterior: observaciones, acuerdos y recomendaciones por cita.
5. Justificaciones: solicitud con categoria, periodo, descripcion, estatus y revision por rol autorizado.
6. Notificaciones: bandeja in-app por usuario, leido/no leido, eventos de citas, justificaciones e incidencias.
7. Incidencias: reporte real, prioridad, estado y filtros operativos.
8. Seguridad: RLS en toda tabla de modulo, sin secretos en cliente, sin permisos basados en `localStorage`.
9. Accesibilidad: labels en formularios, estados de error, foco visible y contraste consistente.
10. Estados reales: carga, error, vacio, permisos insuficientes y exito.

## Estado encontrado

- El shell del dashboard ya usa autenticacion y perfil real.
- `justifications`, `notifications`, `students`, `teachers`, `tutorship_assignments` e `incidents` existen en migraciones.
- El modulo de incidencias ya tiene API real en `apps/web/app/api/incidencias`.
- Las paginas de dashboard, citas, justificaciones, notificaciones, incidencias y chatbot estaban usando datos semilla y `localStorage`.
- Citas estaba documentado, pero no existia una tabla `appointments` en migraciones/tipos generados.

## Trabajo iniciado

- Se agrego `supabase/migrations/20260628000001_create_tutoring_appointments.sql`.
- Se debe ejecutar la migracion y regenerar tipos para que `appointments` quede en `packages/types/src/database.types.ts`.
- Las paginas deben migrarse modulo por modulo a Supabase y mantener el estilo del shell principal.

## Prioridad de implementacion

1. Dashboard real sin metricas inventadas.
2. Citas/tutorias con tabla real.
3. Justificaciones conectadas a `public.justifications`.
4. Notificaciones conectadas a `public.notifications`.
5. Incidencias consumiendo API real.
6. Chatbot: no debe prometer IA si solo hay FAQ local; debe conectarse a tablas de conversaciones cuando el modulo se active.
