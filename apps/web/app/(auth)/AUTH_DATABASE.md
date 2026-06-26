# 🔐 Esquema de Autenticación y Seguridad - SyncUT

**Documento:** Tablas, Relaciones, RLS y Auditoría para Squad 2
**Última actualización:** 2026-05-23
**Responsable:** Squad 2 - Autenticación y Auditoría

---

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Tablas del Sistema](#tablas-del-sistema)
3. [Relaciones y Constraints](#relaciones-y-constraints)
4. [Políticas de RLS](#políticas-de-rls)
5. [Auditoría y Logs](#auditoría-y-logs)
6. [Flujos de Seguridad](#flujos-de-seguridad)
7. [Migraciones SQL](#migraciones-sql)

---

## 🎯 Visión General

SyncUT utiliza un sistema de autenticación multicapa basado en:

- **Supabase Auth** para gestión de credenciales y sesiones (JWT)
- **RLS (Row Level Security)** para control de acceso a nivel de base de datos
- **RBAC (Role-Based Access Control)** para permisos granulares
- **Auditoría inmutable** para trazabilidad de acciones
- **Session Management** para control de dispositivos activos

### Pilares de Seguridad

| Pilar | Responsable | Tabla |
|-------|-------------|-------|
| **Identidad** | Supabase Auth | `auth.users` |
| **Perfiles** | `public.profiles` | Información del usuario |
| **Permisos** | `public.role_permissions` | Control de acceso RBAC |
| **Sesiones** | `public.session_tokens` | Dispositivos activos |
| **Auditoría** | `public.audit_logs` | Trazabilidad inmutable |

---

## 📊 Tablas del Sistema

### 1. **auth.users** (Gestión por Supabase)

**Descripción:** Tabla nativa de Supabase Auth que almacena credenciales y datos de autenticación.

**Ubicación:** `auth.users` (schema interno de Supabase)

**Campos principales:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Identificador único del usuario |
| `email` | text | Correo electrónico del usuario |
| `phone` | text | Teléfono del usuario (opcional) |
| `encrypted_password` | text | Contraseña cifrada (Supabase) |
| `email_confirmed_at` | timestamptz | Timestamp de confirmación de email |
| `created_at` | timestamptz | Fecha de creación |
| `updated_at` | timestamptz | Fecha de última actualización |
| `raw_user_meta_data` | jsonb | Metadatos personalizados (role, full_name) |
| `banned_until` | timestamptz | Ban temporal (null = no baneado) |

**Notas de Seguridad:**
- Las contraseñas se cifran con bcrypt automáticamente
- El JWT se genera con `auth.uid()` como claim principal
- Soporta autenticación con OAuth2 (Google, GitHub, etc.)

---

### 2. **public.profiles** (Perfil del Usuario)

**Descripción:** Extiende `auth.users` con información adicional del usuario y su rol en el sistema.

**Ubicación:** `apps/web/app/(auth)/migrations/`

**Schema:**

```sql
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'student',
  phone text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT role_check CHECK (role IN ('student', 'teacher', 'tutor', 'admin', 'coordinator'))
);
```

**Campos:**

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `id` | uuid | FK a `auth.users.id` | `550e8400-e29b-41d4-a716-446655440000` |
| `email` | text | Correo del usuario (denormalizado) | `estudiante@university.edu` |
| `full_name` | text | Nombre completo del usuario | `Juan Carlos Pérez` |
| `role` | text | Rol del usuario en la plataforma | `student`, `teacher`, `admin` |
| `phone` | text | Número de teléfono (opcional) | `+34 612 345 678` |
| `avatar_url` | text | URL del avatar en Supabase Storage | `https://storage.supabase.co/.../avatar.jpg` |
| `created_at` | timestamptz | Timestamp de creación | `2026-01-15 10:30:00` |
| `updated_at` | timestamptz | Timestamp de última actualización | `2026-05-23 14:45:00` |

**Roles Disponibles:**

- `student` - Estudiante (permisos básicos)
- `teacher` - Profesor (puede calificar y agregar contenido)
- `tutor` - Tutor (soporte académico)
- `coordinator` - Coordinador (gestión de grupos)
- `admin` - Administrador (acceso total)

**Índices:**

```sql
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);
```

---

### 3. **public.role_permissions** (Control de Acceso RBAC)

**Descripción:** Define qué permisos tiene cada rol en el sistema.

**Schema:**

```sql
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, permission),
  CONSTRAINT role_check CHECK (role IN ('student', 'teacher', 'tutor', 'admin', 'coordinator'))
);
```

**Campos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Identificador único |
| `role` | text | Rol al que se asigna el permiso |
| `permission` | text | Nombre del permiso |
| `description` | text | Descripción del permiso (opcional) |
| `created_at` | timestamptz | Timestamp de creación |

**Permisos por Rol (Ejemplo):**

```
STUDENT:
  - view:citas (Ver sus citas)
  - create:citas (Crear nuevas citas)
  - create:justificacion (Crear justificaciones)
  - view:dashboard:personal (Ver su dashboard)

TEACHER:
  - view:citas:all (Ver todas las citas)
  - approve:justificacion (Aprobar justificaciones)
  - create:notificacion (Crear notificaciones)
  - view:dashboard:teacher

COORDINATOR:
  - manage:users (Crear/editar usuarios)
  - manage:appointments (Gestionar citas)
  - view:audit_logs (Ver auditoría)
  - view:dashboard:coordinator

ADMIN:
  - * (Acceso total)
```

---

### 4. **public.session_tokens** (Gestión de Sesiones y Dispositivos)

**Descripción:** Almacena información de sesiones activas, permitiendo revocar tokens por dispositivo o ubicación.

**Schema:**

```sql
CREATE TABLE public.session_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  device_name text,
  ip_address inet,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);
```

**Campos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Identificador único de la sesión |
| `user_id` | uuid | FK a `public.profiles.id` |
| `token` | text | Token JWT o sesión (UNIQUE) |
| `device_name` | text | Nombre del dispositivo (ej: "iPhone 15 Pro") |
| `ip_address` | inet | Dirección IP de la sesión |
| `expires_at` | timestamptz | Cuándo expira la sesión |
| `created_at` | timestamptz | Timestamp de inicio de sesión |
| `revoked_at` | timestamptz | Timestamp de revocación (NULL = activa) |

**Índices:**

```sql
CREATE INDEX idx_session_tokens_user_id ON public.session_tokens(user_id);
CREATE INDEX idx_session_tokens_expires_at ON public.session_tokens(expires_at);
```

**Casos de Uso:**

- Rastrear dispositivos del usuario
- Revocar sesiones específicas (cierre de sesión desde otro dispositivo)
- Detectar acceso sospechoso (IP, ubicación)
- Implementar límite de dispositivos simultáneos

---

### 5. **public.audit_logs** (Auditoría Inmutable)

**Descripción:** Registro inmutable de TODAS las acciones del sistema para cumplimiento normativo y seguridad.

**Schema:**

```sql
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);
```

**Campos:**

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `id` | uuid | Identificador único del evento | Auto-generado |
| `user_id` | uuid | FK a `public.profiles.id` (NULL si sin autenticación) | UUID del usuario |
| `action` | text | Acción realizada | `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT` |
| `table_name` | text | Tabla afectada | `profiles`, `citas`, `justificaciones` |
| `record_id` | uuid | ID del registro modificado | UUID del cita/justificación |
| `old_values` | jsonb | Estado anterior del registro | `{"email":"old@domain.com"}` |
| `new_values` | jsonb | Estado nuevo del registro | `{"email":"new@domain.com"}` |
| `ip_address` | inet | IP del cliente | `192.168.1.1` |
| `user_agent` | text | User-Agent del navegador | `Mozilla/5.0...` |
| `created_at` | timestamptz | Timestamp del evento | Auto-generado |

**Índices:**

```sql
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
```

**Acciones Auditadas:**

| Acción | Tabla | Descripción |
|--------|-------|-------------|
| `LOGIN` | `auth.users` | Usuario inicia sesión |
| `LOGOUT` | `session_tokens` | Usuario cierra sesión |
| `SIGNUP` | `profiles` | Nuevo usuario registrado |
| `PASSWORD_CHANGE` | `auth.users` | Cambio de contraseña |
| `PASSWORD_RESET` | `auth.users` | Reinicio de contraseña |
| `EMAIL_CHANGE` | `auth.users` | Cambio de email |
| `ROLE_UPDATE` | `profiles` | Cambio de rol del usuario |
| `PROFILE_UPDATE` | `profiles` | Edición de perfil |
| `SESSION_REVOKED` | `session_tokens` | Sesión revocada |
| `PERMISSION_GRANTED` | `role_permissions` | Permiso otorgado |
| `PERMISSION_REVOKED` | `role_permissions` | Permiso revocado |
| `ACCESS_DENIED` | N/A | Intento de acceso denegado |
| `FAILED_LOGIN` | `auth.users` | Intento fallido de login |

---

## 🔗 Relaciones y Constraints

### Diagrama de Relaciones

```
┌─────────────────────┐
│   auth.users        │
│ (Supabase Auth)     │
│                     │
│ PK: id (uuid)       │
│ • email             │
│ • password (enc)    │
│ • email_confirmed   │
│ • raw_user_meta_data│
└──────────┬──────────┘
           │ 1:1 ON DELETE CASCADE
           │
┌──────────▼──────────┐
│ public.profiles     │◄─────────┐ Extiende con rol
│                     │          │ e info adicional
│ PK: id (uuid) ◄─────┘          │
│ • email (denom)     │
│ • full_name         │
│ • role              │
│ • phone             │
│ • avatar_url        │
│ • created_at        │
│ • updated_at        │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
    │1:N          │1:N
    │             │
┌───▼─────────────┴────────┐
│ public.session_tokens    │
│                          │
│ PK: id (uuid)            │
│ FK: user_id ─────────────┤
│ • token (unique)         │
│ • device_name            │
│ • ip_address             │
│ • expires_at             │
│ • revoked_at (nullable)  │
└──────────────────────────┘

┌──────────────────────┐
│ public.role_          │
│ permissions          │
│                      │
│ PK: id (uuid)        │
│ • role (ref)         │
│ • permission (text)  │
│ • UNIQUE(role,perm)  │
└──────────────────────┘

┌──────────────────────┐
│ public.audit_logs    │
│ (Inmutable)          │
│                      │
│ PK: id (uuid)        │
│ FK: user_id ◄────────┤ (nullable)
│ • action             │
│ • table_name         │
│ • record_id          │
│ • old_values (jsonb) │
│ • new_values (jsonb) │
│ • ip_address         │
│ • user_agent         │
│ • created_at (asc)   │
└──────────────────────┘
```

### Constraints

```sql
-- profiles
- PK: id REFERENCES auth.users(id) ON DELETE CASCADE
- CONSTRAINT role_check: role IN (...)
- UNIQUE(email)

-- session_tokens
- PK: id
- FK: user_id REFERENCES profiles(id) ON DELETE CASCADE
- UNIQUE(token)

-- audit_logs
- PK: id
- FK: user_id REFERENCES profiles(id) ON DELETE SET NULL

-- role_permissions
- PK: id
- UNIQUE(role, permission)
- CONSTRAINT role_check: role IN (...)
```

---

## 🛡️ Políticas de RLS (Row Level Security)

### 1. **profiles - Self View**

```sql
CREATE POLICY "profiles_self_view"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id          -- Los usuarios ven su propio perfil
    OR role = 'admin'        -- Los admins ven todos los perfiles
  );
```

**Efecto:** Solo pueden ver:
- Sus propios datos
- Si son admin: todos los perfiles

---

### 2. **profiles - Update Own**

```sql
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR role = 'admin')
  WITH CHECK (auth.uid() = id OR role = 'admin');
```

**Efecto:** Solo pueden actualizar:
- Sus propios datos
- Si son admin: cualquier perfil

**Protección:** No pueden cambiar su propio `role` sin pasar por admin

---

### 3. **audit_logs - View**

```sql
CREATE POLICY "audit_logs_view"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()           -- Ver tus propios logs
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'  -- Admins ven todo
    )
  );
```

**Efecto:** 
- Estudiantes solo ven sus propias acciones
- Admins ven todo el historial

---

### 4. **audit_logs - No Delete**

```sql
CREATE POLICY "audit_logs_no_delete"
  ON public.audit_logs
  FOR DELETE
  TO authenticated
  USING (false);  -- NUNCA se puede eliminar (inmutable)
```

**Efecto:** Los audit logs son completamente inmutables

---

### 5. **session_tokens - View**

```sql
CREATE POLICY "session_tokens_view"
  ON public.session_tokens
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()           -- Ver tus propias sesiones
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Efecto:**
- Usuarios ven sus dispositivos
- Admins ven todos los dispositivos

---

### 6. **role_permissions - View**

```sql
CREATE POLICY "role_permissions_view"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (true);  -- Todos los roles autenticados ven los permisos
```

**Efecto:** Transparencia total de permisos del sistema

---

## 📋 Auditoría y Logs

### Tipos de Eventos Auditados

#### **A. Eventos de Autenticación**

| Evento | Trigger | Tabla | Datos Capturados |
|--------|---------|-------|------------------|
| `LOGIN` | Usuario inicia sesión | `session_tokens` | IP, Device, User-Agent |
| `LOGOUT` | Usuario cierra sesión | `session_tokens` | IP, Token |
| `LOGIN_FAILED` | 3+ intentos fallidos | `auth.users` | IP, Email, Motivo |
| `SIGNUP` | Nuevo registro | `profiles` | Email, Role, IP |
| `PASSWORD_CHANGE` | Usuario cambia contraseña | `auth.users` | IP, Timestamp |
| `PASSWORD_RESET` | Reset de contraseña | `auth.users` | Email, IP |
| `EMAIL_CHANGE` | Cambio de email | `auth.users` | Old Email, New Email, IP |
| `EMAIL_CONFIRMED` | Email verificado | `auth.users` | Email, Timestamp |
| `SESSION_REVOKED` | Admin revoca sesión | `session_tokens` | User, Device, Admin ID |
| `BAN_USER` | Admin banea usuario | `auth.users` | User ID, Reason, Duration |

#### **B. Eventos de Control de Acceso**

| Evento | Trigger | Tabla | Datos Capturados |
|--------|---------|-------|------------------|
| `ROLE_UPDATED` | Cambio de rol de usuario | `profiles` | Old Role, New Role, Admin ID |
| `PERMISSION_GRANTED` | Nuevo permiso otorgado | `role_permissions` | Role, Permission, Admin |
| `PERMISSION_REVOKED` | Permiso revocado | `role_permissions` | Role, Permission, Admin |
| `ACCESS_DENIED` | Intento de acceso denegado | N/A | User, Resource, Motivo |
| `RLS_POLICY_APPLIED` | Política RLS activa | N/A | Table, Policy, Result |

#### **C. Eventos de Datos**

| Evento | Trigger | Tabla | Datos Capturados |
|--------|---------|-------|------------------|
| `PROFILE_UPDATE` | Edición de perfil | `profiles` | Old Values, New Values |
| `CITA_CREATE` | Nueva cita | `appointments` | All Values |
| `CITA_UPDATE` | Edición de cita | `appointments` | Old Values, New Values |
| `CITA_DELETE` | Eliminación de cita | `appointments` | Old Values |
| `JUSTIFICACION_CREATE` | Nueva justificación | `justificaciones` | All Values |
| `JUSTIFICACION_UPDATE` | Cambio de estado | `justificaciones` | Old Status, New Status |
| `NOTIFICACION_SEND` | Notificación enviada | `notifications` | Recipients, Content |

### Función de Auditoría

```typescript
// apps/web/app/(auth)/lib/auditLog.ts

interface AuditLogEntry {
  userId?: string;        // UUID o null
  action: string;         // LOGIN, CREATE, UPDATE, DELETE, etc.
  tableName: string;      // Tabla afectada
  recordId?: string;      // ID del registro modificado
  oldValues?: Record;     // Valores anteriores
  newValues?: Record;     // Valores nuevos
  ipAddress: string;      // IP del cliente
  userAgent: string;      // User-Agent del navegador
}

export async function logAudit(entry: AuditLogEntry) {
  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      user_id: entry.userId,
      action: entry.action,
      table_name: entry.tableName,
      record_id: entry.recordId,
      old_values: entry.oldValues,
      new_values: entry.newValues,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
    });

  if (error) {
    console.error('Audit log failed:', error);
    // No hacer throw para no interrumpir la operación
  }
  return data;
}
```

---

## 🔐 Flujos de Seguridad

### 1. **Flujo de Registro (Signup)**

```
┌─ Usuario completa formulario
│  ├─ Email
│  ├─ Contraseña
│  └─ Nombre completo
│
├─ Validación frontend
│  ├─ Email válido
│  ├─ Contraseña fuerte (8+ chars, mayús, minús, número)
│  └─ Términos aceptados
│
├─ POST /auth/signup (Server Action)
│  │
│  ├─ supabase.auth.signUp({email, password, metadata: {full_name}})
│  │  └─ Supabase crea auth.users + envía email de confirmación
│  │
│  ├─ TRIGGER: handle_new_user()
│  │  └─ INSERT INTO profiles (id, email, full_name, role='student')
│  │
│  ├─ AUDIT: INSERT INTO audit_logs
│  │  └─ {action: 'SIGNUP', table: 'profiles', user_id: null, ip, ua}
│  │
│  └─ Response: {status: 'pending_confirmation', requiresEmailVerification: true}
│
└─ Usuario recibe email con link de confirmación
   │
   ├─ Click en link → Supabase confirma email
   │  └─ auth.users.email_confirmed_at = now()
   │
   └─ AUDIT: {action: 'EMAIL_CONFIRMED', user_id: uid, ip, ua}
```

### 2. **Flujo de Login**

```
┌─ Usuario ingresa email y contraseña
│
├─ POST /auth/login (Server Action)
│  │
│  ├─ supabase.auth.signInWithPassword({email, password})
│  │  └─ Valida credenciales contra auth.users
│  │
│  ├─ Si SUCCESS:
│  │  │
│  │  ├─ Crea sesión JWT
│  │  ├─ INSERT INTO session_tokens
│  │  │  └─ {user_id, token, device_name, ip_address, expires_at}
│  │  │
│  │  ├─ AUDIT: {action: 'LOGIN', user_id: uid, ip, ua}
│  │  │
│  │  ├─ Crea cookie segura HttpOnly
│  │  └─ Response: {status: 'authenticated', role}
│  │
│  └─ Si FAIL:
│     ├─ AUDIT: {action: 'LOGIN_FAILED', reason, ip, ua}
│     ├─ Si 3+ fallos en 15min → Bloquea temporalmente
│     └─ Response: {error: 'Invalid credentials'}
│
├─ Middleware valida JWT en cada request
│  ├─ auth.uid() extraído del JWT
│  ├─ Verifica RLS policies
│  └─ Permite/deniega acceso
│
└─ Frontend almacena estado en Zustand store
   └─ useAuthStore: {user, role, isAuthenticated}
```

### 3. **Flujo de Cambio de Contraseña**

```
┌─ Usuario va a Configuración → Cambiar contraseña
│
├─ POST /auth/change-password
│  │
│  ├─ Validar contraseña actual
│  ├─ Validar nueva contraseña (fuerza)
│  ├─ supabase.auth.updateUser({password: newPassword})
│  │
│  ├─ REVOKE todas las sesiones activas
│  │  ├─ UPDATE session_tokens
│  │  │  └─ SET revoked_at = now() WHERE user_id = auth.uid()
│  │  └─ AUDIT: {action: 'SESSION_REVOKED_BY_PASSWORD_CHANGE', ...}
│  │
│  ├─ AUDIT: {action: 'PASSWORD_CHANGE', user_id, ip, ua}
│  │
│  └─ Response: {status: 'success', message: 'Todas las sesiones cerradas'}
│
└─ Usuario debe volver a iniciar sesión en todos los dispositivos
```

### 4. **Flujo de Control de Acceso (RLS)**

```
┌─ Usuario autenticado realiza query
│  ├─ SELECT * FROM profiles WHERE id = target_id
│  └─ Supabase obtiene auth.uid() del JWT
│
├─ Supabase evalúa RLS Policy
│  │
│  ├─ Policy: "profiles_self_view"
│  │  ├─ IF auth.uid() = id THEN ✓ ALLOW
│  │  ├─ IF role = 'admin' THEN ✓ ALLOW
│  │  └─ ELSE ✗ DENY
│  │
│  └─ Query se filtra automáticamente
│     ├─ Si estudiante pide su perfil → ✓ Retorna
│     ├─ Si estudiante pide otro perfil → ✗ Vacío
│     └─ Si admin pide cualquiera → ✓ Retorna
│
├─ AUDIT (si acceso denegado):
│  └─ {action: 'ACCESS_DENIED', table: 'profiles', ip, ua}
│
└─ Response: Datos filtrados por RLS
```

### 5. **Flujo de Auditoría Inmutable**

```
┌─ Cualquier acción en el sistema
│  ├─ CRUD en bases de datos
│  ├─ Cambios de estado
│  └─ Eventos de autenticación
│
├─ Database Trigger O App Code
│  └─ logAudit({action, table_name, old_values, new_values, ...})
│
├─ INSERT INTO audit_logs (id, user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at)
│  │
│  └─ RLS: Nadie puede DELETE (policy_no_delete returns false)
│
├─ Audit Log creado
│  ├─ Timestamp inmutable en base de datos
│  ├─ No se puede modificar (created_at es DEFAULT)
│  └─ Solo SELECT con RLS (usuario ve sus logs, admin ve todo)
│
└─ Query de auditoría
   ├─ SELECT * FROM audit_logs WHERE created_at > 2026-01-01
   ├─ RLS filtra automáticamente
   └─ Admin obtiene historial completo
```

---

## 🗄️ Migraciones SQL

### Migración 1: Schema Inicial

**Archivo:** `supabase/migrations/20240516000001_init_schemas.sql`

```sql
-- ============ TABLA: profiles ============
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'student',
  phone text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT role_check CHECK (role IN ('student', 'teacher', 'tutor', 'admin', 'coordinator'))
);

CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- ============ TABLA: role_permissions ============
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, permission),
  CONSTRAINT role_check CHECK (role IN ('student', 'teacher', 'tutor', 'admin', 'coordinator'))
);

-- ============ TABLA: audit_logs ============
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- ============ TABLA: session_tokens ============
CREATE TABLE IF NOT EXISTS public.session_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  device_name text,
  ip_address inet,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX idx_session_tokens_user_id ON public.session_tokens(user_id);
CREATE INDEX idx_session_tokens_expires_at ON public.session_tokens(expires_at);

-- ============ ENABLE RLS ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============
-- [Incluir todas las políticas del apartado anterior]
```

### Migración 2: Sincronización Auth-Profiles

**Archivo:** `supabase/migrations/20260523000001_sync_auth_profiles.sql`

```sql
-- Crear función que gestiona la inserción automática
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario'),
    COALESCE(new.raw_user_meta_data->>'role', 'student')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 🎯 Checklist de Implementación - Squad 2

### Fase 1: Setup Base (Semana 1)

- [ ] Ejecutar migración `20240516000001_init_schemas.sql`
- [ ] Ejecutar migración `20260523000001_sync_auth_profiles.sql`
- [ ] Verificar tablas creadas en Supabase Dashboard
- [ ] Confirmar RLS policies activas
- [ ] Crear índices de performance

### Fase 2: Autenticación (Semana 2)

- [ ] Implementar página de signup (`(auth)/signup/page.tsx`)
- [ ] Implementar página de login (`(auth)/login/page.tsx`)
- [ ] Crear middleware de autenticación
- [ ] Implementar logAudit() en utils
- [ ] Crear tests para auth flow

### Fase 3: Sesiones y Seguridad (Semana 3)

- [ ] Implementar gestión de sesiones (`session_tokens`)
- [ ] Crear endpoint para "revocar sesión"
- [ ] Implementar límite de dispositivos simultáneos
- [ ] Crear página de dispositivos activos
- [ ] Implementar 2FA (opcional)

### Fase 4: Auditoría y Logs (Semana 4)

- [ ] Conectar logAudit() a todos los endpoints críticos
- [ ] Crear dashboard de auditoría para admins
- [ ] Exportar logs a CSV/JSON
- [ ] Configurar retención de logs (RGPD)
- [ ] Documentar compliance

---

## 📞 Puntos de Contacto

**Squad 2 - Autenticación:**
- Líder: [Nombre]
- Slack: #squad-2-auth
- Documentación: `/docs/squad-2-auditoría/README.md`

**Preguntas sobre:**
- Tablas y schemas: Squad 2
- Migraciones SQL: Squad 2
- Integraciones auth: Squad 2
- RLS policies: Squad 2

---

## 📚 Referencias

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL JSONB](https://www.postgresql.org/docs/current/datatype-json.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

**Última revisión:** 2026-05-23
**Próxima revisión:** 2026-06-23
**Versión:** 1.0
