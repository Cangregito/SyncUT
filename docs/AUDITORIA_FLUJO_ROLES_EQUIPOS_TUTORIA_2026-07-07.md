# Auditoria de flujo de roles, cuentas y equipos tutoriales

Fecha: 2026-07-07

## Investigacion aplicada

- Supabase Auth soporta invitaciones administrativas con `inviteUserByEmail`, adecuado para cuentas creadas por administracion.
- Supabase requiere configurar `Site URL` y allow list de redirects; en produccion debe dejar de apuntar a `localhost`.
- El acceso a informacion academica debe responder a interes educativo legitimo: tutor ve alumnos asignados, docente recibe avisos dirigidos, coordinacion/admin supervisan.
- La plataforma debe usar RBAC y RLS como frontera de datos, no solo ocultar botones en UI.

## Flujo definido

1. Admin crea o invita staff desde `/admin`.
2. Solo roles `coordinator`, `teacher` y `tutor` se administran desde ese panel.
3. El registro publico queda reservado para alumnos con correo `Al########@utcj.edu.mx`.
4. Tutor entra a `/equipo`, crea un equipo tutorial y comparte el codigo de 6 caracteres.
5. Alumno entra a `/equipo`, captura el codigo y queda vinculado al tutor.
6. La union al equipo crea/actualiza:
   - `students`
   - `tutor_team_members`
   - `tutorship_assignments`
7. Citas ya consume `tutorship_assignments`, por lo que queda conectada al equipo.
8. Justificaciones ahora permite lectura al tutor solo si tiene asignacion activa con el alumno.
9. Tutor/coordinacion/admin pueden enviar notificaciones a docentes desde `/equipo`.
10. Docente recibe aviso in-app/email mediante el sistema de notificaciones existente.

## Implementacion realizada

- Migracion `20260707000001_tutor_team_flow.sql`.
- Nuevas tablas:
  - `tutor_teams`
  - `tutor_team_members`
- Nuevas RPCs:
  - `create_tutor_team`
  - `join_tutor_team`
  - `send_tutor_teacher_notification`
  - `get_teacher_directory`
- Nuevo modulo UI:
  - `/equipo`
- Panel admin extendido:
  - alta/invitacion de coordinadores, docentes y tutores
- Roles extendidos:
  - permiso `notifications:send`

## Checklist de produccion

- Definir `NEXT_PUBLIC_APP_URL` con URL real.
- Definir `SUPABASE_SERVICE_ROLE_KEY` solo en servidor/Vercel, nunca en cliente.
- En Supabase Auth, configurar `Site URL` a produccion.
- En Supabase Auth, agregar redirects permitidos:
  - `/auth/callback`
  - `/auth/callback?next=/dashboard`
  - `/auth/callback?next=/reset-password`
- Ejecutar migraciones en Supabase.
- Confirmar SMTP/plantillas para que `email_queue` salga realmente.
- Crear staff desde `/admin`; no pedirles usar `/signup`.
