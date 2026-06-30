# Squad 4 — Base de Datos: Módulo de Notificaciones y Email

**Proyecto:** SyncUT  
**Squad:** Squad 4 — Notificaciones y Email  
**Integrantes:** Fernando · Vidales · Ari · Roman  
**Dependencia bloqueante:** Squad 2 (Auth) debe tener `auth.users` disponible antes de ejecutar estas migraciones.

---

## Misión del módulo

Diseñar y construir el motor centralizado de mensajería asíncrona para automatizar envíos de correos electrónicos y alertas institucionales dentro de SyncUT.

---

## Alcance funcional

- Envío de correo transaccional y notificaciones operativas.
- Gestión de plantillas de correo (React Email).
- Cola de procesamiento asíncrono de mensajes.
- Registro de estado de entrega y errores.
- Centro de notificaciones in-app por usuario.

---

## Entregables mínimos del módulo

| Entregable | Responsable sugerido | Estado |
|---|---|---|
| Servicio de notificaciones por correo (Resend) | Fernando | ⬜ Pendiente |
| Plantillas base: bienvenida, aviso de cita, cambio de estatus | Vidales | ⬜ Pendiente |
| Cola asíncrona de eventos (Edge Function) | Ari | ⬜ Pendiente |
| Centro de notificaciones in-app (`NotificationCenter`) | Roman | ⬜ Pendiente |
| Registro de eventos de envío (`notification_logs`) | Squad 4 | ⬜ Pendiente |

---

## Rutas y carpetas propietarias

```
apps/web/app/(notificaciones)/     ← UI del centro de notificaciones (Roman)
packages/shared/                   ← Estado compartido y utilidades cross-squad
supabase/migrations/               ← Migraciones del esquema (coordinado con Squads 1, 2)
docs/squad-4-notificaciones/       ← Documentación interna del squad
```

> No modificar rutas de otros squads sin actualizar el `Master Operating Guide`.

---

## Dependencias entre equipos

| Dependencia | Equipo productor | Tipo |
|---|---|---|
| Autenticación y contexto de usuario (`auth.users`) | Equipo 2 | 🔴 Bloqueante |
| Eventos de citas (confirmed, cancelled, reminder) | Equipo 3 | 🟡 Integración |
| Eventos de justificaciones (submitted, approved, rejected) | Equipo 1 | 🟡 Integración |
| Eventos adicionales por definir | Equipos 5 y 6 | 🔵 Por coordinar |

> Squad 4 es **consumidor** de eventos: los equipos productores llaman a las Server Actions o funciones del módulo de notificaciones para disparar mensajes. Squad 4 no sondea otros módulos.

---

## Ubicación de migraciones

Todas las migraciones deben vivir en:

```
supabase/migrations/
```

Nombrar archivos con timestamp ISO + descripción corta. El Squad 4 es responsable de las siguientes:

```
20240601000001_create_notification_event_types.sql
20240601000002_create_notifications.sql
20240601000003_create_notification_preferences.sql
20240601000004_create_email_queue.sql
20240601000005_create_notification_logs.sql
20240601000006_rls_policies_notifications.sql
20240601000007_seed_notification_event_types.sql
```

> Las migraciones que afecten tablas compartidas (ej. `auth.users`) deben coordinarse con Squad 2 antes del merge.

---

## Esquema: `notifications`

Todas las tablas de este módulo viven en el schema `public` de Supabase. Las claves foráneas a usuarios apuntan a `auth.users(id)` (provisto por Squad 2).

---

## Tablas

### 1. `notification_event_types`

Catálogo de los tipos de eventos que el sistema puede emitir. Insertado por seed, no por usuarios.

```sql
CREATE TABLE public.notification_event_types (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,          -- e.g. 'appointment.confirmed'
  label       TEXT NOT NULL,                 -- Etiqueta legible para UI
  description TEXT,
  channel     TEXT NOT NULL                  -- 'in_app' | 'email' | 'both'
    CHECK (channel IN ('in_app', 'email', 'both')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.notification_event_types IS
  'Catálogo de tipos de eventos que generan notificaciones. Mantenido por Squad 4.';
```

**Datos iniciales (seed — archivo `20240601000007_seed_notification_event_types.sql`):**

| slug | label | channel | Plantilla email |
|---|---|---|---|
| `auth.welcome` | Bienvenida al sistema | `email` | `welcome` |
| `auth.password_reset` | Restablecimiento de contraseña | `email` | `password-reset` |
| `appointment.confirmed` | Cita confirmada | `both` | `appointment-confirmed` |
| `appointment.cancelled` | Cita cancelada | `both` | `appointment-cancelled` |
| `appointment.reminder` | Recordatorio de cita | `both` | `appointment-reminder` |
| `appointment.status_changed` | Cambio de estatus de cita | `both` | `appointment-status` |
| `justification.submitted` | Justificación enviada | `in_app` | — |
| `justification.approved` | Justificación aprobada | `both` | `justification-approved` |
| `justification.rejected` | Justificación rechazada | `both` | `justification-rejected` |

> Las columnas `template_slug` en `email_queue` deben coincidir exactamente con los identificadores de la columna **Plantilla email** de esta tabla. Vidales/Fernando son responsables de crear los archivos correspondientes en React Email.

---

### 2. `notifications`

Registro principal de notificaciones in-app. Cada fila es una notificación dirigida a un usuario específico.

```sql
CREATE TABLE public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL REFERENCES public.notification_event_types(slug),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  metadata     JSONB DEFAULT '{}',            -- Datos extra: cita_id, justificacion_id, etc.
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id      ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read      ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at   ON public.notifications(created_at DESC);

COMMENT ON TABLE public.notifications IS
  'Notificaciones in-app por usuario. Leídas/no leídas se gestionan aquí.';
COMMENT ON COLUMN public.notifications.metadata IS
  'Payload libre en JSON. Ejemplos: {"appointment_id": "uuid"}, {"justification_id": "uuid"}.';
```

---

### 3. `notification_preferences`

Preferencias por usuario: qué tipos de eventos quiere recibir y por qué canal.

```sql
CREATE TABLE public.notification_preferences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL REFERENCES public.notification_event_types(slug),
  in_app       BOOLEAN NOT NULL DEFAULT TRUE,
  email        BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, event_type)
);

CREATE INDEX idx_notif_prefs_user ON public.notification_preferences(user_id);

COMMENT ON TABLE public.notification_preferences IS
  'Preferencias de canal por usuario y tipo de evento.';
```

> **Nota:** Si un usuario no tiene fila para un `event_type`, el sistema asume los defaults del catálogo (`notification_event_types.channel`).

---

### 4. `email_queue`

Cola asíncrona de emails pendientes de envío. Procesada por la Edge Function de Squad 4 vía Resend.

```sql
CREATE TYPE public.email_status AS ENUM ('pending', 'processing', 'sent', 'failed', 'cancelled');

CREATE TABLE public.email_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_email        TEXT NOT NULL,
  subject         TEXT NOT NULL,
  template_slug   TEXT NOT NULL,              -- e.g. 'welcome', 'password-reset'
  template_data   JSONB NOT NULL DEFAULT '{}',-- Variables para la plantilla React Email
  status          public.email_status NOT NULL DEFAULT 'pending',
  attempts        SMALLINT NOT NULL DEFAULT 0,
  max_attempts    SMALLINT NOT NULL DEFAULT 3,
  last_error      TEXT,
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_queue_status       ON public.email_queue(status, scheduled_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX idx_email_queue_user_id      ON public.email_queue(user_id);

COMMENT ON TABLE public.email_queue IS
  'Cola de emails para despacho asíncrono mediante Resend. Procesada por Edge Function.';
COMMENT ON COLUMN public.email_queue.template_slug IS
  'Identificador de la plantilla React Email a renderizar (Fernando/Vidales).';
COMMENT ON COLUMN public.email_queue.template_data IS
  'Variables inyectadas en la plantilla. Ejemplo: {"name": "Juan", "reset_url": "https://..."}.';
```

---

### 5. `notification_logs`

Auditoría de todos los eventos de notificación disparados. Útil para debugging y trazabilidad.

```sql
CREATE TABLE public.notification_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT NOT NULL,
  user_id         UUID,                       -- Puede ser NULL si es broadcast o sistema
  notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
  email_queue_id  UUID REFERENCES public.email_queue(id) ON DELETE SET NULL,
  triggered_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Quién disparó el evento
  payload         JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_logs_user_id    ON public.notification_logs(user_id);
CREATE INDEX idx_notif_logs_event_type ON public.notification_logs(event_type);
CREATE INDEX idx_notif_logs_created_at ON public.notification_logs(created_at DESC);

COMMENT ON TABLE public.notification_logs IS
  'Log de auditoría de todos los eventos de notificación emitidos.';
```

---

## Políticas RLS

Habilitar Row Level Security en todas las tablas de usuario. Las tablas de catálogo y logs son de solo lectura para usuarios autenticados.

```sql
-- ─── notifications ───────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Solo funciones del servidor (service role) pueden insertar notificaciones
CREATE POLICY "service_insert_notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role');


-- ─── notification_preferences ─────────────────────────────────────────────
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_preferences"
  ON public.notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── email_queue ──────────────────────────────────────────────────────────
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Solo service role puede leer/escribir la cola
CREATE POLICY "service_role_only_email_queue"
  ON public.email_queue FOR ALL
  USING (auth.role() = 'service_role');


-- ─── notification_logs ────────────────────────────────────────────────────
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_insert_logs"
  ON public.notification_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "users_see_own_logs"
  ON public.notification_logs FOR SELECT
  USING (auth.uid() = user_id);


-- ─── notification_event_types (catálogo público de lectura) ──────────────
ALTER TABLE public.notification_event_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_event_types"
  ON public.notification_event_types FOR SELECT
  TO authenticated
  USING (TRUE);
```

---

## Diagrama de relaciones

```
auth.users (Squad 2)
    │
    ├──< notifications >──── notification_event_types
    │         │
    │         └──< notification_logs
    │
    ├──< notification_preferences >──── notification_event_types
    │
    └──< email_queue >──< notification_logs
```

---

## Variables de entorno requeridas

Definidas en `.env.local` para desarrollo local y en los secrets de Vercel/Supabase para producción. **No commitear valores reales al repositorio.** Consultar `.env.example` en la raíz del monorepo como referencia de las claves esperadas.

```env
# Resend — obtener en https://resend.com/api-keys
# ⚠️ Sin prefijo NEXT_PUBLIC_: esta clave solo vive en el servidor
RESEND_API_KEY=re_xxxxxxxxxxxx

# Supabase — para Edge Functions y Server Actions
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Solo para desarrollo local con Supabase CLI
SUPABASE_ANON_KEY=eyJ...
```

> **Regla del proyecto:** Nunca usar `NEXT_PUBLIC_` para claves de Resend o el service role de Supabase. Estas claves deben usarse exclusivamente en Edge Functions o Server Actions bajo `(notificaciones)/actions/`.

---

## Edge Function: `process-email-queue`

Ubicación según reglas del proyecto:

```
supabase/functions/process-email-queue/index.ts
```

Responsable: **Ari**

Lógica esperada:

1. Consultar `email_queue` donde `status = 'pending'` y `scheduled_at <= NOW()`.
2. Marcar como `processing`.
3. Renderizar la plantilla con `template_slug` + `template_data`.
4. Enviar con `Resend`.
5. Marcar como `sent` o incrementar `attempts` / marcar `failed` si supera `max_attempts`.
6. Insertar fila en `notification_logs`.

---

## Estado de dependencias con otros Squads

| Dependencia | Squad | Tipo | Estado |
|---|---|---|---|
| `auth.users` disponible | Squad 2 | 🔴 Bloqueante | ⚠️ Esperar |
| Tabla de perfiles de usuario | Squad 2 | 🔴 Bloqueante | ⚠️ Esperar |
| Políticas RLS y middleware | Squad 2 | 🔴 Bloqueante | ⚠️ Esperar |
| `appointment_id` en metadata / eventos de citas | Squad 3 | 🟡 Integración | Contrato por definir |
| `justification_id` en metadata / eventos de justificaciones | Squad 1 | 🟡 Integración | Contrato por definir |
| Eventos adicionales por definir | Squads 5 y 6 | 🔵 Por coordinar | Sin iniciar |

> Squad 4 actúa como **receptor de eventos**. Cada equipo productor debe llamar a las Server Actions bajo `(notificaciones)/actions/` para disparar notificaciones. No se hace polling entre módulos.

---

## Checklist antes de ejecutar migraciones

**Requisitos de Squad 2:**
- [ ] Squad 2 confirmó que `auth.users` está disponible en el entorno de desarrollo.
- [ ] Políticas RLS revisadas con Squad 2 (roles y middleware).
- [ ] Tabla de perfiles de usuario disponible (si `notifications` la referencia).

**Requisitos internos de Squad 4:**
- [ ] `.env.local` configurado con `RESEND_API_KEY` válida (no commitear).
- [ ] `.env.example` en la raíz actualizado con los nombres de las nuevas variables.
- [ ] Archivos de migración nombrados con timestamp correcto y en orden.
- [ ] Seed de `notification_event_types` incluido en migración separada.
- [ ] Plantillas React Email creadas para cada `template_slug` del catálogo (Vidales/Fernando).
- [ ] Edge Function `process-email-queue` implementada y testeada localmente (Ari).
- [ ] Componente `NotificationCenter` con conexión a tabla `notifications` (Roman).
- [ ] PR revisado por al menos un integrante del squad antes de merge.

**Coordinación con equipos productores:**
- [ ] Contrato de eventos definido con Squad 3 (citas) — qué payload envían y cuándo.
- [ ] Contrato de eventos definido con Squad 1 (justificaciones) — qué payload envían y cuándo.
- [ ] Comunicar a Squads 5 y 6 el formato de llamada a las Server Actions del módulo.
