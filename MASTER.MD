# Plataforma Universitaria Integral - Documento Maestro de Ingeniería (README)

## 🏢 1. Arquitectura Empresarial del Sistema (SaaS)

Este documento constituye el **Plan Maestro Inicial y Guía de Gobernanza** para el desarrollo de la Plataforma Universitaria Integral. El sistema está diseñado bajo un modelo de software como servicio (SaaS) multi-rol (alumnos, tutores, padres, maestros y coordinadores), utilizando una arquitectura moderna de alto rendimiento, optimizada para la velocidad de entrega, consistencia relacional y costo operativo eficiente en la nube.

### Stack Tecnológico Obligatorio
* **Frontend Core:** Next.js 14+ (App Router) con TypeScript Estricto.
* **Diseño y UI:** Tailwind CSS + Radix UI / Shadcn UI para consistencia atómica.
* **Backend, Auth y Base de Datos:** Supabase (PostgreSQL nativo con Row Level Security y Edge Functions).
* **Mensajería Transaccional:** Resend (E-mails mediante React Email).
* **Hosting, CI/CD e Infraestructura:** Vercel Enterprise Serverless.
* **Control de Versiones y Repositorio:** GitHub Enterprise.
* **Dominio Oficial:** Ecosistema bajo TLD `.site`.

### Decisiones de Arquitectura Estratégica
1. **Pivot Serverless con Monorepo (Turborepo):** Se descarta el monolito pesado tradicional en favor de un entorno gestionado por Turborepo. Esto permite acoplar contratos y tipos estáticos en un solo repositorio, garantizando compilaciones ultrarrápidas a través de caché distribuida y aislando el despliegue de micro-aplicaciones en Vercel.
2. **Consistencia Relacional Segura:** Toda la persistencia core académica reside en PostgreSQL dentro de Supabase. El rendimiento de consultas complejas y tabulares se resuelve mediante vistas indexadas y funciones almacenadas (RPC), mientras que los procesos de desacoplamiento de eventos se ejecutan a nivel de base de datos con *Database Triggers* y colas asíncronas en Edge Functions.
3. **Seguridad Perimetral en la Capa de Datos (RLS):** La seguridad no recae únicamente en el servidor de aplicaciones. Supabase Row Level Security (RLS) actúa como el firewall principal del sistema, impidiendo de forma nativa que un rol no autorizado acceda a registros ajenos, incluso si realiza llamadas directas desde el cliente web.

### Stack Técnico Final (Versiones Gratuitas)
* **Frontend:** Next.js 14+ (App Router) + TypeScript + Tailwind CSS + Shadcn UI
* **Backend/BD:** Supabase Free Tier (PostgreSQL + Auth + Storage + Edge Functions)
* **Email:** Resend Free Tier (50 emails/día iniciales)
* **Hosting:** Vercel Free Tier + Serverless Functions
* **Versionamiento:** GitHub Free (Repositorio público/privado)
* **Testing:** Playwright (E2E), pgTAP (DB Unit Tests), Vitest (Unit Tests)
* **Package Manager:** pnpm 8+ (gestor monorepo)

---

## 1.5 🎯 MVP Mínimo Viable - Fase Lanzamiento

El proyecto se divide en **fases de entrega incremental**. Para el MVP de lanzamiento se deben completar **100%** las siguientes capacidades:

### MVP Fase 1 - Núcleo Académico Base (12 semanas)
**Objetivo:** Sistema operativo de registro y autenticación de usuarios con acceso a datos académicos.

| Feature | Squad Responsable | Prioridad | Estado |
|---------|------------------|-----------|--------|
| Autenticación (Sign-in/Sign-up/MFA) | Squad 2 | 🔴 BLOQUEANTE | Por hacer |
| Perfiles de Usuario (Alumno/Docente/Admin) | Squad 2 | 🔴 BLOQUEANTE | Por hacer |
| Dashboard Base (Navegación según rol) | Staff General | 🔴 BLOQUEANTE | Por hacer |
| Sistema de Notificaciones (Email básico) | Squad 4 | 🟡 CRÍTICO | Por hacer |
| Gestión de Citas Académicas | Squad 3 | 🟡 CRÍTICO | Por hacer |
| Carga de Justificaciones (Upload + Aprobación) | Squad 1 | 🟡 CRÍTICO | Por hacer |
| Auditoría de Acciones (Logging inmutable) | Squad 2 | 🟡 CRÍTICO | Por hacer |

**Features EXCLUIDAS del MVP Fase 1:**
- ❌ Semáforo de Incidencias (Squad 5) → Fase 2
- ❌ Chatbot (Squad 6) → Fase 2
- ❌ Reportes Avanzados → Fase 2
- ❌ Integración con SIS legado → Fase 3

**Criterio de Aceptación del MVP:**
- ✅ Todos los 7 features listados completamente funcionales en producción
- ✅ 0 deuda técnica crítica identificada
- ✅ 95%+ de coverage en tests críticos (Auth, RLS, Notificaciones)
- ✅ Cada miembro del squad con mínimo 3 commits auditados

---

##  2. Estructura Completa del Monorepo

El proyecto utiliza un esquema de organización de código modular y escalable para entornos de desarrollo masivos.

```text
plataforma-universitaria/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                 # Pipeline de validación automatizada (Lint, Typecheck, Test)
│   │   └── release.yml            # Pipeline de generación de tags, versiones y Changelogs
│   └── pull_request_template.md   # Formato mandatorio de auditoría técnica para Code Reviews
├── apps/
│   └── web/                       # Aplicación Next.js Principal (App Router)
│       ├── app/
│       │   ├── (auth)/            # Rutas aisladas de autenticación (Login, MFA, Recovery)
│       │   ├── (dashboard)/       # Layout protegido principal con control de navegación lateral
│       │   │   ├── citas/         # Espacio de trabajo del Squad 3
│       │   │   ├── incidencias/   # Espacio de trabajo del Squad 5
│       │   │   └── tramites/      # Espacio de trabajo del Squad 1 (Justificaciones)
│       │   ├── api/               # Endpoints del servidor (Webhooks e integraciones externas)
│       │   └── middleware.ts      # Interceptor Edge global para sesiones y RBAC
│       └── public/                # Recursos estáticos institucionales
├── packages/
│   ├── ui/                        # Sistema de diseño compartido, componentes atómicos y Tailwind
│   ├── contracts/                 # Esquemas de datos, contratos de eventos y payloads transaccionales
│   ├── sdk/                       # Clientes centralizados y adaptadores de Supabase/Resend
│   ├── config/                    # Configuraciones compartidas de ESLint, Prettier y TypeScript
│   ├── types/                     # Tipados autogenerados de la base de datos PostgreSQL
│   └── shared/                    # Utilidades de negocio, validaciones con Zod y constantes globales
├── docs/                          # Repositorio centralizado de documentación de módulos (.md)
├── scripts/                       # Scripts de automatización, migraciones y sincronización local
├── turbo.json                     # Configuración del motor de compilación Turborepo
└── package.json                   # Raíz de dependencias compartidas y Workspaces de pnpm
👥 3. Gestión, Gobernanza y Organización de SquadsEl desarrollo se ejecuta mediante células de trabajo (squads) autónomas y multidisciplinarias, coordinadas bajo un modelo de gobernanza ágil.Equipo / SquadResponsabilidad PrincipalMiembros AsignadosEntregables Clave en el MonorepoStaff GerencialGobernanza ejecutiva, comité de arquitectura, control de alcance, CI/CD global y entornos cloud.Angel, Magdalena, Roberto, Jassiel (Líder principal), Karlaturbo.json, packages/config, políticas de entornos en Vercel, diseño de esquemas base en Supabase.Equipo 2 - AuditoríaControl de identidad, Roles (RBAC), MFA, auditoría inmutable de eventos sensibles y tokens de sesión.Alexander, Alan, Wallmach, Erickpackages/sdk (Cliente Auth), apps/web/middleware.ts, Esquema de base de datos de auditoría y triggers.Equipo 4 - NotificaciónMensajería omnicanal, colas de envío, plantillas de correo dinámicas integradas con la API de Resend.Fernando, Vidales, Ari, Romanpackages/shared/emails (React Email), Supabase Edge Functions para automatización de envío de correos.Equipo 3 - CitasGestión de agendas académicas, calendarios de disponibilidad de docentes y asignación de citas a alumnos.Karim, Rivera, Fernan, Eduardoapps/web/app/(dashboard)/citas, Tablas citas y disponibilidad_docente con reglas de validación en Supabase.Equipo 1 - JustificaciónFlujos de aprobación de incidencias (BPM), resguardo y carga segura de evidencias en almacenamiento de objetos.Joel, Alfonso, Aaronapps/web/app/(dashboard)/tramites, Políticas de Supabase Storage para protección de archivos PDF/Imágenes.Equipo 5 - IncidenciasSemáforo de riesgo académico, KPIs de deserción temprana, alertamiento masivo y vistas de reporteo.Marvin, Osmara, Kevinapps/web/app/(dashboard)/incidencias, Componentes gráficos interactivos y llamadas RPC agregadas.Equipo 6 - ChatbotInterfaz inteligente de atención automatizada, integración de base de conocimiento (FAQ) y RAG.Alexis, Samantha, Rey, PabloInterfaz de soporte flotante en packages/ui, integración con Edge Functions y APIs de Modelos de Lenguaje.Dependencias Críticas e Interacciones entre SquadsEl Gran Bloqueador Técnico (Squad 2): Ningún equipo puede realizar consultas de datos protegidos o mutaciones sin que el Squad de Auditoría provea el cliente de autenticación, el esquema de perfiles académicos y el Middleware de enrutamiento seguro. Su avance representa la Ruta Crítica del Sprint 0 y 1.Sincronización de Notificaciones (Squad 4): Actúa como servicio transversal. Los Squads de Citas (3) y Justificaciones (1) no implementan lógica de mensajería; deben realizar inserciones en la tabla global de eventos para que el motor del Squad 4 procese el envío mediante Resend de forma asíncrona.🎨 4. Estandarización Obligatoria (Sprint 0)Antes de iniciar la codificación de lógica de negocio, se congelan los cimientos técnicos en la capa del monorepo.Configuración Maestra de Tailwind (packages/ui/tailwind.config.js)JavaScript/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "../../apps/web/app/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          500: '#22c55e', // Verde institucional
          600: '#16a34a',
          900: '#14532d',
        },
        institutional: {
          slate: '#1e293b',
          dark: '#0f172a',
          amber: '#f59e0b',
        }
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'sans-serif'],
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
Inicialización Única del Cliente Supabase (packages/sdk/src/client.ts)TypeScriptimport { createBrowserClient } from '@supabase/ssr';
import { Database } from '@plataforma/types';

/**
 * Cliente único y optimizado para componentes del lado del cliente (Navegador).
 * Utiliza los tipos estrictos de base de datos autogenerados.
 */
export const createSupabaseBrowserClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};
Control de Accesos y Seguridad RLS BaseEl acceso a los datos de la base de datos se rige estrictamente por políticas RLS atómicas adjuntas a las migraciones:SQL-- Forzar el uso de Row Level Security en la tabla de perfiles de usuario
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política de lectura: Un usuario autenticado solo lee su perfil o el de sus alumnos asignados
CREATE POLICY "Visualización estricta de perfiles académicos"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR
  EXISTS (
    SELECT 1 FROM public.tutorship_assignments
    WHERE tutor_id = auth.uid() AND student_id = public.profiles.id
  )
);
```

---

## 3.5 🗄️ Esquema de Base de Datos Completo (Squad 2 - Auditoría - RUTA CRÍTICA)

Este esquema es **BLOQUEANTE** para todos los demás equipos. Debe estar 100% definido, migrado y testeado en Sprint 0.

### 3.5.1 Tablas Core de Autenticación y Perfiles

```sql
-- ============ TABLA: profiles (Perfiles de Usuario) ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'student', -- student, teacher, tutor, admin, coordinator
  phone text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT role_check CHECK (role IN ('student', 'teacher', 'tutor', 'admin', 'coordinator'))
);

CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- ============ TABLA: role_permissions (Control de Acceso RBAC) ============
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, permission),
  CONSTRAINT role_check CHECK (role IN ('student', 'teacher', 'tutor', 'admin', 'coordinator'))
);

-- ============ TABLA: audit_logs (Auditoría Inmutable de Eventos) ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
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

-- ============ TABLA: session_tokens (Gestión de Sesiones) ============
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

CREATE INDEX idx_session_tokens_user_id ON public.session_tokens(user_id);
CREATE INDEX idx_session_tokens_expires_at ON public.session_tokens(expires_at);
```

### 3.5.2 Tablas de Relaciones Académicas

```sql
-- ============ TABLA: students (Perfil Extendido de Estudiantes) ============
CREATE TABLE public.students (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_code text UNIQUE NOT NULL,
  cohort text NOT NULL,
  career text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'dropped')),
  enrollment_date date NOT NULL,
  expected_graduation date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_students_cohort ON public.students(cohort);
CREATE INDEX idx_students_career ON public.students(career);

-- ============ TABLA: teachers (Perfil Extendido de Docentes) ============
CREATE TABLE public.teachers (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_code text UNIQUE NOT NULL,
  department text NOT NULL,
  specialization text[],
  availability_hours jsonb,
  office_location text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============ TABLA: tutorship_assignments (Asignación de Tutorías) ============
CREATE TABLE public.tutorship_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assigned_date date DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'transferred')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(tutor_id, student_id)
);

CREATE INDEX idx_tutorship_tutor_id ON public.tutorship_assignments(tutor_id);
CREATE INDEX idx_tutorship_student_id ON public.tutorship_assignments(student_id);
```

### 3.5.3 RLS Policies Completas (Seguridad Crítica)

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_self_view"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR role = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.tutorship_assignments
      WHERE tutor_id = auth.uid() AND student_id = id
    )
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR role = 'admin')
  WITH CHECK (auth.uid() = id OR role = 'admin');

CREATE POLICY "profiles_insert_admin_only"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (role = 'admin');

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_view"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "audit_logs_insert_system"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "audit_logs_no_delete"
  ON public.audit_logs
  FOR DELETE
  TO authenticated
  USING (false);

ALTER TABLE public.session_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_tokens_view"
  ON public.session_tokens
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "session_tokens_revoke_own"
  ON public.session_tokens
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND revoked_at IS NOT NULL);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_view"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.tutorship_assignments
      WHERE tutor_id = auth.uid() AND student_id = id
    )
  );

ALTER TABLE public.tutorship_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutorship_view"
  ON public.tutorship_assignments
  FOR SELECT
  TO authenticated
  USING (
    tutor_id = auth.uid()
    OR student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## 4 🛠️ Gobernanza Git y Pipeline DevOps (CI/CD)Flujo de Ramas (Branching Model)main: Producción estable y protegida. Apunta directamente a plataforma.[dominio].site.develop: Línea base de integración continua y ambiente de pruebas integradas (Staging). Apunta a staging.plataforma.[dominio].site.feature/squad-[num]-[nombre]: Ramas de desarrollo de características específicas que se desprenden obligatoriamente de develop.hotfix/*: Correcciones urgentes de producción que se mezclan tanto a main como a develop.Reglas Críticas de Repositorio en GitHubProtección de Ramas: Las ramas main y develop requieren aprobación obligatoria de al menos un miembro del Staff Gerencial para efectuar un merge.Limpia de Historial: No se permiten merges directos que ensucien el árbol de Git. Es obligatorio realizar git rebase develop antes de someter un Pull Request para garantizar un historial completamente lineal.Estándar de Mensajes (Conventional Commits): Cada commit debe ser legible por máquinas para automatizar notas de versión:feat(squad-3): agregar validación de colisiones de horarios en citasfix(squad-2): solucionar expiración prematura del token en middlewaredocs(squad-1): expandir diagrama de flujo de carga de evidencias médicasPipeline de Automatización (.github/workflows/ci.yml)YAMLname: Pipeline de Integración Continua (CI)

on:
  pull_request:
    branches: [develop, main]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Clonar código fuente
        uses: actions/checkout@v4

      - name: Instalar NodeJS y Pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 8

      - name: Configurar Cache Global de Turborepo
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Instalar Dependencias del Monorepo
        run: pnpm install --frozen-lockfile

      - name: Validación de Estilo de Código (Lint)
        run: pnpm turbo lint

      - name: Validación de Tipado Estricto (TypeScript)
        run: pnpm turbo typecheck

      - name: Ejecución de Pruebas Unitarias
        run: pnpm turbo test
Configuración Automática de Entornos de Despliegue en VercelVercel leerá la raíz del monorepo e interpretará el archivo turbo.json. Se configuran 3 entornos aislados:Entorno de Producción: Vinculado a la rama main. Realiza la optimización estática de producción completa.Entorno de Staging: Vinculado a la rama develop. Utiliza bases de datos e instancias de pruebas en Supabase para validación antes de liberación.Entorno de Preview (Rama de Características): Cada Pull Request abierto genera una URL efímera e independiente controlada por Vercel para pruebas en dispositivos reales y revisiones por el Tech Lead. 6. Configuración Inicial del Sistema (Guía de Comandos)Para clonar e inicializar el entorno de desarrollo de manera uniforme entre todos los squads, ejecute la siguiente secuencia estructurada en su terminal local:Bash# 1. Preparación del Entorno Local e Inicialización del Monorepo
mkdir plataforma-universitaria && cd plataforma-universitaria
pnpm init

# 2. Creación del Archivo de Espacios de Trabajo de Pnpm
cat <<EOF > pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
EOF

# 3. Creación Física Organizada de Módulos y Paquetes Core
mkdir -p apps/web packages/ui packages/sdk packages/config packages/types packages/shared docs scripts

# 4. Inicialización Homogénea de Next.js en la Carpeta del Workspace
pnpm create next-app@latest apps/web --ts --tailwind --eslint --app --src-dir=false --import-alias="@/*"

# 5. Configuración de Git Corporativo e Inyección a Servidores Seguros de GitHub
git init
git branch -M main
git checkout -b develop

# Login automático mediante GitHub CLI y creación del repositorio privado de la universidad
gh auth login
gh repo create plataforma-universitaria --private --source=. --remote=origin

# 6. Enlace de Infraestructura con los Servidores Cloud de Vercel
pnpm dlx vercel login
pnpm dlx vercel link --yes
 7. Control de Calidad y Criterios de Aceptación (DoD / DoR)Definition of Ready (DoR) - Requisitos para iniciar una tareaLa historia de usuario o tarea técnica cuenta con criterios de aceptación explícitos y un diseño de interfaz validado por el Staff Gerencial.Las dependencias con otros squads se encuentran resueltas o simuladas mediante interfaces (mocking).Se han definido con claridad las tablas o campos de base de datos necesarios en Supabase.Definition of Done (DoD) - Requisitos para cerrar una tareaEl código compila localmente de forma limpia sin advertencias de linters (pnpm turbo lint pasa exitosamente).No existen tipos evasivos o genéricos (any) en el código TypeScript expuesto.Las políticas RLS asociadas han sido probadas y validadas en el panel de control de Supabase.El Pull Request cuenta con el historial de commits lineal unificado mediante un rebase limpio de Git.Se cuenta con la aprobación firmada de al menos un par técnico y el visto bueno del Staff Gerencial.⚠️ 8. Matriz de Riesgos de Ingeniería y Mitigaciones TécnicasEvento de RiesgoImpacto TécnicoAcción de Mitigación InmediataAgotamiento de Conexiones en Supabase (Connection Pooling): Las Server Actions y el Middleware de Next.js en Vercel escalan de forma masiva ante ráfagas de tráfico, abriendo múltiples hilos de conexión independientes hacia PostgreSQL.Crítico. Caídas de base de datos o latencias extremas en peticiones concurrentes de alumnos.Forzar a todos los desarrolladores a inicializar el cliente de Supabase apuntando de forma obligatoria al puerto de Supavisor (Supabase Connection Pooler) configurado en modo transacción (Transaction Mode).Desalineación Crítica de Tipos entre Squads: Cambios imprevistos en la estructura de una tabla realizados por un squad rompen los componentes visuales o llamadas de APIs de otros equipos.Alto. Errores imprevistos en tiempo de compilación y bloqueos en el pipeline de CI/CD en la rama develop.Automatizar la ejecución del comando supabase gen types typescript en el gancho de pre-commit local y centralizar los archivos de migración de base de datos bajo control estricto de aprobación del Squad de Auditoría.Filtros RLS Defectuosos o Incompletos: Una política mal formulada podría dar acceso inadvertido a roles de Alumnos sobre expedientes e incidencias restringidas de coordinadores académicos.Bloqueante. Exposición pública de registros escolares confidenciales.Implementar pruebas automatizadas a nivel de base de datos (Database Unit Tests) utilizando la herramienta pgTAP dentro del entorno de Supabase para validar accesos restringidos antes de liberar a producción.

---

## 5 📋 Timeline de Sprints y Deliverables

**Duración Total del MVP:** 12 semanas (3 meses) | **Equipo:** 24 personas (6 squads + Staff)

### Sprint 0 (Semana 1-2): Fundamentos Técnicos y Cimientos
**Objetivo:** Preparar la infraestructura y bloquear dependencias.

| Tarea | Squad | Responsable | Deadline | Entregable |
|-------|-------|-------------|----------|-----------|
| Crear repositorio GitHub + configurar Branch Protection | Staff | Jassiel | Día 2 | URL de repo + guidelines |
| Inicializar monorepo (Turborepo + pnpm) | Staff | Jassiel | Día 2 | Estructura base del proyecto |
| Configurar Supabase (Project creation + Billing) | Staff | Angel/Magdalena | Día 1 | Supabase URL + API Keys |
| Crear esquema BD completo (Auditoría) | Squad 2 | Alexander/Alan | Día 7 | Migraciones SQL en `/supabase/migrations` |
| Implementar RLS Policies + Triggers | Squad 2 | Wallmach/Erick | Día 10 | Políticas testeadas en panel Supabase |
| Configurar Vercel (3 entornos: prod/staging/preview) | Staff | Roberto | Día 3 | Deployments automáticos por rama |
| Resend API Key + Template base de email | Squad 4 | Fernando | Día 5 | Cliente Resend inicializado |
| TypeScript autogenerado de BD | Squad 2 | Alexander | Día 11 | `packages/types/database.types.ts` |
| Configurar ESLint + Prettier + Husky (pre-commit hooks) | Staff | Jassiel | Día 5 | `.eslintrc.json`, `.prettierrc`, `pre-commit` |
| Setup local de CI/CD pipeline (.github/workflows) | Staff | Roberto | Día 8 | Workflows funcionales para PR |
| **Checkpoint:** Todos los squads corren 1 PR de prueba | Todos | Todos | Día 12 | 6 PRs mergeados con ✅ aprobación |

**Entregable Final Sprint 0:** Repositorio operativo con BD, tipos autogenerados, CI/CD funcional y 0 bugs bloqueantes.

---

### Sprint 1 (Semana 3-5): Autenticación y Perfiles (Squad 2 Liderando)
**Objetivo:** Sistema de login/signup funcional con autenticación multi-rol.

| Tarea | Squad | Responsable | Deadline | Entregable |
|-------|-------|-------------|----------|-----------|
| Signup (Email + Password) con validaciones Zod | Squad 2 | Alexander | Día 15 | Componente `SignupForm` + Server Action |
| Login (Email + Password + Remember Me) | Squad 2 | Alan | Día 15 | Página `app/(auth)/login` |
| MFA (TOTP/SMS) implementación | Squad 2 | Wallmach | Día 18 | Setup MFA en Supabase + UI `MFAModal` |
| Password Recovery + Reset Email | Squad 2 | Erick | Día 16 | Link de reset seguro (24h válido) |
| Middleware de Autenticación (Session Management) | Squad 2 | Alexander | Día 20 | `middleware.ts` con verificación de sesión |
| Perfiles de Usuario (6 roles: student/teacher/tutor/admin/coordinator/guest) | Squad 2 | Alan | Día 21 | Tablas `profiles` + `role_permissions` populadas |
| Dashboard Base (Layout por rol) | Staff General | Jassiel | Día 22 | Rutas `app/(dashboard)/layout` protegidas |
| Testing E2E (Auth flows) | Squad 2 | Wallmach | Día 23 | Tests Playwright: login, signup, MFA |
| Testing RLS Policies | Squad 2 | Erick | Día 23 | pgTAP tests: validar accesos por rol |
| Auditoría de eventos de auth | Squad 2 | Alexander | Día 24 | `audit_logs` completando on login/logout |
| **Checkpoint:** Todos pueden loguearse sin errores TypeScript | Todos | Todos | Día 24 | 0 "any" types en auth |

**Entregable Final Sprint 1:** Sistema de autenticación 100% funcional. Cualquier usuario puede crear cuenta y loguearse.

---

### Sprint 2 (Semana 6-8): Squad 4 (Notificaciones) + Squad 3 (Citas)
**Objetivo:** Notificaciones operacionales y gestión de citas académicas.

#### **Squad 4 (Notificaciones)** - Paralelamente en Sprint 2

| Tarea | Responsable | Deadline | Entregable |
|-------|-------------|----------|-----------|
| Sistema de eventos (tabla `events` + cola asíncrona) | Fernando | Día 32 | Edge Function disparando emails vía Resend |
| Plantillas de email (React Email) | Vidales | Día 33 | 5 templates: welcome, password-reset, cita-confirmada, etc. |
| Testing SMTP (Resend sandbox) | Ari | Día 34 | 100 emails de prueba procesados sin error |
| Dashboard de Notificaciones (Bell icon + dropdown) | Roman | Día 35 | Componente `NotificationCenter` en Shadcn |

#### **Squad 3 (Citas)** - Paralelamente en Sprint 2

| Tarea | Responsable | Deadline | Entregable |
|-------|-------------|----------|-----------|
| Tabla BD: `appointments` + `teacher_availability` | Karim | Día 32 | Migraciones con validaciones CHECK |
| Calendar Widget (Shadcn + React Big Calendar) | Rivera | Día 34 | Componente editable de calendario de citas |
| Lógica de reserva (Validar colisiones de horarios) | Fernan | Día 35 | Server Action: `bookAppointment()` con trigger automático de notificación |
| Listar citas del usuario (Student view) | Eduardo | Día 35 | Query en `app/(dashboard)/citas` |
| Testing E2E (Booking flow) | Karim | Día 36 | Playwright: crear cita → enviar email → aparece en dashboard |

**Entregable Final Sprint 2:** Usuarios reciben emails reales. Pueden agendar citas. Sistema de notificaciones operativo.

---

### Sprint 3 (Semana 9-12): Squad 1 (Justificaciones) + Pulido General
**Objetivo:** Completar MVP con justificaciones y QA final.

| Tarea | Squad | Responsable | Deadline | Entregable |
|-------|-------|-------------|----------|-----------|
| Tabla BD: `justifications` + `justification_files` | Squad 1 | Joel | Día 45 | Storage policies configuradas en Supabase |
| Upload de archivos (PDF/IMG) con validación | Squad 1 | Alfonso | Día 47 | Componente `FileUploadZone` + virus scan |
| Workflow de aprobación (BPM: Pendiente → Aprobado/Rechazado) | Squad 1 | Aaron | Día 49 | Server Action: `submitJustification()` → notificación |
| Auditoria visual (Quién aprobó cuándo) | Squad 1 | Joel | Día 50 | Tabla de historial inmutable en UI |
| Testing E2E (Upload → Approval) | Squad 1 | Alfonso | Día 51 | Playwright: cargar PDF → admin aprueba → email enviado |
| QA y Bug Fixes (Release Candidate) | Todos | Todos | Día 52-56 | Regresión testing en 3 navegadores |
| **Final Checkpoint:** Load Testing con 100 usuarios simultáneos | Staff | Roberto | Día 57 | 0 timeouts, response time < 1s |
| **Deployment a Producción** | Staff | Jassiel | Día 58 | `main` branch con v1.0.0 |

**Entregable Final MVP:** Plataforma universitaria operativa con 7 features principales listas para producción.

---

## 6 🧪 Estrategia Completa de Testing y QA

### 6.1 Testing por Niveles

```
┌─────────────────────────────────────────────────────────┐
│                    Testing Pyramid                       │
├─────────────────────────────────────────────────────────┤
│                 E2E Tests (Playwright)  │ 10% Coverage   │
│                        ▲                                 │
│                    Integration  │ 30% Coverage           │
│                   ▲   (SDK calls, API chains)            │
│          ▲   Unit Tests (Vitest) │ 60% Coverage         │
│     ▲   (Functions, Components)                          │
│   RLS Database Tests (pgTAP) │ 90% Coverage             │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Unit Tests (Vitest) - Responsabilidad: Squad Correspondiente

**Ubicación:** `packages/shared/utils/__tests__` y `apps/web/**/__tests__`

```bash
# Ejecutar todos los tests unitarios
pnpm turbo test

# Con cobertura
pnpm turbo test -- --coverage
```

**Cobertura Mínima Requerida:**
- Auth: 95% (funciones sensibles)
- Validaciones Zod: 100%
- Utilities: 80%
- Components UI: 60%

**Ejemplo Test - Validación de Email:**
```typescript
// packages/shared/validators/__tests__/email.test.ts
import { validateEmail } from '../email';

describe('Email Validation', () => {
  it('should accept valid emails', () => {
    expect(validateEmail('student@utcj.edu.mx')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(validateEmail('not-an-email')).toBe(false);
  });

  it('should reject SQL injection attempts', () => {
    expect(validateEmail("'; DROP TABLE users; --")).toBe(false);
  });
});
```

### 6.3 Integration Tests (API Chains) - Responsabilidad: Squad 2 + Squads Cliente

**Ubicación:** `apps/web/__tests__/integration`

**Caso de Uso: Signup → Email Enviado → Login Funciona**

```typescript
// apps/web/__tests__/integration/auth.signup.test.ts
import { signupUser } from '@/app/(auth)/actions';
import { sendEmail } from '@packages/sdk/emails';

describe('Auth Signup Integration', () => {
  it('should create user, send email, and allow login', async () => {
    // 1. Signup
    const user = await signupUser({
      email: 'test@university.edu',
      password: 'SecurePass123!',
    });
    expect(user.id).toBeDefined();

    // 2. Email enviado (mock Resend)
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'test@university.edu',
      template: 'welcome',
    });

    // 3. Login funciona
    const session = await loginUser({
      email: 'test@university.edu',
      password: 'SecurePass123!',
    });
    expect(session.token).toBeDefined();
  });
});
```

### 6.4 E2E Tests (Playwright) - Responsabilidad: Squad Correspondiente

**Ubicación:** `apps/web/e2e`

**Herramienta:** Playwright (headless Chrome/Firefox/Safari)

```bash
# Instalar
pnpm add -D @playwright/test

# Ejecutar E2E tests
pnpm exec playwright test

# UI Mode (ver pasos)
pnpm exec playwright test --ui
```

**Caso Crítico 1: Complete Auth Flow**

```typescript
// e2e/auth-complete-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Complete Authentication Flow', () => {
  test('should signup → verify email → login → access dashboard', async ({ page }) => {
    // 1. Navegar a signup
    await page.goto('/auth/signup');

    // 2. Llenar formulario
    await page.fill('input[name="email"]', 'newstudent@university.edu');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.fill('input[name="confirmPassword"]', 'SecurePass123!');

    // 3. Enviar
    await page.click('button[type="submit"]');

    // 4. Esperar verificación por email
    await expect(page).toHaveURL(/.*verification-pending/);

    // 5. Simular click en email (en testing se puede saltar)
    await page.goto('/auth/verify?token=mock-token');

    // 6. Redirigir a login
    await expect(page).toHaveURL(/.*login/);

    // 7. Login
    await page.fill('input[name="email"]', 'newstudent@university.edu');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');

    // 8. Acceso a dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('text=Bienvenido')).toBeVisible();
  });

  test('should enforce MFA when enabled', async ({ page }) => {
    // Test MFA en login
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'mfa-user@university.edu');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');

    // Debe mostrar input de MFA
    await expect(page.locator('input[name="mfa-code"]')).toBeVisible();

    // MFA incorrecto
    await page.fill('input[name="mfa-code"]', '000000');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Código inválido')).toBeVisible();

    // MFA correcto (mock)
    await page.fill('input[name="mfa-code"]', '123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });
});
```

**Caso Crítico 2: Appointment Booking + Notification**

```typescript
// e2e/appointments-flow.spec.ts
test('should book appointment and receive email notification', async ({ page }) => {
  // 1. Login como estudiante
  await loginAs(page, 'student@university.edu');

  // 2. Navegar a citas
  await page.goto('/dashboard/citas');

  // 3. Seleccionar docente
  await page.click('select[name="teacher"]');
  await page.click('text=Dr. García');

  // 4. Seleccionar fecha/hora
  await page.click('button:has-text("15 de Mayo")');
  await page.click('button:has-text("10:00 AM")');

  // 5. Confirmar
  await page.click('button[type="submit"]');

  // 6. Verificar confirmación
  await expect(page.locator('text=Cita agendada')).toBeVisible();

  // 7. Verificar que aparece en calendariolocal
  await expect(page.locator('text=Dr. García - 10:00 AM')).toBeVisible();

  // 8. Email enviado (verificar en logs o mock)
  // Nota: En test puedes hacer intercept y validar
});
```

### 6.5 RLS/Database Security Tests (pgTAP) - Responsabilidad: Squad 2

**Ubicación:** `supabase/tests`

**Herramienta:** pgTAP (PostgreSQL Unit Testing)

```bash
# Instalar pgTAP en Supabase
# Supabase CLI ya incluye soporte

# Ejecutar DB tests
supabase test db
```

**Caso Crítico 1: RLS - Student No Puede Ver Otros Estudiantes**

```sql
-- supabase/tests/rls-student-isolation.sql
BEGIN;
SELECT plan(5);

-- Setup: Crear 2 usuarios
SELECT 'Create test users'::text;
INSERT INTO auth.users (id, email) VALUES
  ('student-1-uuid', 'student1@uni.edu'),
  ('student-2-uuid', 'student2@uni.edu');

INSERT INTO public.profiles (id, email, full_name, role) VALUES
  ('student-1-uuid', 'student1@uni.edu', 'Student 1', 'student'),
  ('student-2-uuid', 'student2@uni.edu', 'Student 2', 'student');

-- Test 1: Student 1 ve su propio perfil
SELECT
  is(
    (SELECT COUNT(*) FROM public.profiles
     WHERE id = 'student-1-uuid' AND auth.uid() = 'student-1-uuid')::int,
    1,
    'Student 1 should see own profile'
  );

-- Test 2: Student 1 NO ve perfil de Student 2
SELECT
  is(
    (SELECT COUNT(*) FROM public.profiles
     WHERE id = 'student-2-uuid' AND auth.uid() = 'student-1-uuid')::int,
    0,
    'Student 1 should NOT see Student 2 profile'
  );

-- Test 3: Student 1 NO puede UPDATE perfil de Student 2
SELECT
  is(
    (UPDATE public.profiles SET full_name = 'HACKED' 
     WHERE id = 'student-2-uuid' AND auth.uid() = 'student-1-uuid'
     RETURNING id)::text,
    NULL,
    'Student 1 cannot update Student 2 profile'
  );

-- Test 4: Audit logs son inmutables
SELECT
  is(
    (DELETE FROM public.audit_logs WHERE id = 'any-id' AND auth.uid() = 'student-1-uuid'
     RETURNING id)::text,
    NULL,
    'Students cannot delete audit logs'
  );

-- Test 5: Admin ve todo
SELECT
  is(
    (SELECT COUNT(*) FROM public.profiles
     WHERE auth.uid() IN (
       SELECT id FROM public.profiles WHERE role = 'admin'
     ))::int,
    2,
    'Admin can see all profiles'
  );

SELECT * FROM finish();
ROLLBACK;
```

### 6.6 Load Testing (Apache JMeter) - Responsabilidad: Staff

```bash
# Simular 100 usuarios simultáneos
jmeter -n -t load_test.jmx -l results.jtl -j jmeter.log

# Criterios de éxito:
# - Response time p95 < 1000ms
# - Error rate < 0.1%
# - No se agotan conexiones Supabase
```

### 6.7 Checklist de Testing por Release

**Antes de hacer MERGE a `develop`:**
- ✅ Unit tests pasan (pnpm test)
- ✅ Lint y TypeScript pasan (pnpm turbo lint, typecheck)
- ✅ Sin "any" types
- ✅ E2E tests de feature específica pasan
- ✅ RLS policies testeadas

**Antes de hacer MERGE a `main` (Producción):**
- ✅ Todos los anteriores +
- ✅ Load testing en staging (< 1s response time)
- ✅ Smoke testing manual en staging
- ✅ Changelog actualizado
- ✅ Aprobación de Staff + Tech Lead

---

## 7 🖥️ Setup Completo desde CMD (Guía Paso a Paso)

### Prerequisitos
- Node.js 20+ instalado (`node --version`)
- Git instalado (`git --version`)
- Cuentas gratuitas creadas en: Supabase, Vercel, GitHub

### Parte 1: Inicializar Monorepo y Repositorio

```bash
# 1. Crear directorio del proyecto
mkdir plataforma-universitaria
cd plataforma-universitaria

# 2. Inicializar Git
git init
git config user.name "Tu Nombre"
git config user.email "tu@university.edu"
git branch -M main
git checkout -b develop

# 3. Crear archivo de workspaces pnpm
echo 'packages:
  - "apps/*"
  - "packages/*"' > pnpm-workspace.yaml

# 4. Inicializar package.json raíz
npm init -y
# Editar package.json para agregar:
# {
#   "private": true,
#   "workspaces": ["apps/*", "packages/*"],
#   "scripts": {
#     "dev": "turbo run dev",
#     "build": "turbo run build",
#     "test": "turbo run test",
#     "lint": "turbo run lint",
#     "typecheck": "turbo run typecheck"
#   }
# }

# 5. Instalar pnpm si no lo tienes
npm install -g pnpm

# 6. Instalar dependencias raíz
pnpm install -D turbo eslint prettier typescript @types/node

# 7. Crear estructura de carpetas
mkdir -p apps/web packages/{ui,sdk,config,types,shared} docs scripts .github/workflows

# 8. Crear turbo.json
cat > turbo.json << 'EOF'
{
  "globalDependencies": ["**/.env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "lint": {
      "outputs": []
    },
    "typecheck": {
      "outputs": []
    },
    "test": {
      "outputs": ["coverage/**"]
    }
  }
}
EOF

# 9. Conectar con GitHub
gh auth login
gh repo create plataforma-universitaria --private --source=. --remote=origin --push
```

### Parte 2: Configurar Supabase

```bash
# 1. Instalar Supabase CLI
npm install -g supabase

# 2. Autenticarse en Supabase
supabase login

# 3. Crear proyecto Supabase en dashboard (no desde CLI)
# - Ir a supabase.com
# - New project → región: Iowa (us-west-1) → Tier: Free
# - Esperar 2-3 minutos
# - Copiar: Project URL y anon key

# 4. Crear .env.local en raíz del proyecto
cat > .env.local << 'EOF'
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxxx... # Obtener de Supabase Settings > API

# Resend
NEXT_PUBLIC_RESEND_API_KEY=re_xxxx...

# Vercel
VERCEL_TOKEN=xxxx... # Obtener de Vercel dashboard
EOF

# 5. Crear carpeta de migraciones Supabase
mkdir -p supabase/migrations

# 6. Crear primera migración SQL
cat > supabase/migrations/20240516000001_init_schemas.sql << 'EOF'
-- Este archivo contendrá el schema de Squad 2
-- Copiado del MASTER.MD sección 3.5
EOF

# 7. Aplicar migraciones localmente
supabase db push

# 8. Generar tipos TypeScript desde BD
supabase gen types typescript --linked > packages/types/database.types.ts
```

### Parte 3: Configurar Next.js App

```bash
# 1. Crear app Next.js
cd apps/web
pnpm create next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias="@/*"

cd ../..

# 2. Instalar dependencias globales del monorepo
pnpm install -D \
  @supabase/ssr \
  @supabase/supabase-js \
  resend \
  react-email \
  zod \
  zustand \
  @hookform/resolvers \
  react-hook-form \
  date-fns \
  clsx \
  tailwind-merge

# 3. Instalar Shadcn UI
pnpm dlx shadcn-ui@latest init -d

# 4. Instalar testing
pnpm install -D \
  vitest \
  @testing-library/react \
  @testing-library/jest-dom \
  @playwright/test
```

### Parte 4: Configurar CI/CD (GitHub Actions)

```bash
# 1. Crear workflow de CI
mkdir -p .github/workflows

cat > .github/workflows/ci.yml << 'EOF'
name: CI Pipeline

on:
  pull_request:
    branches: [develop, main]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm turbo lint
      - run: pnpm turbo typecheck
      - run: pnpm turbo test
      - run: pnpm turbo build
EOF

git add .github/
git commit -m "ci: setup GitHub Actions pipeline"
```

### Parte 5: Deploy en Vercel

```bash
# 1. Conectar Vercel
pnpm dlx vercel login

# 2. Crear proyecto en Vercel
pnpm dlx vercel link --yes

# 3. Configurar variables de entorno en Vercel
# Ir a: Vercel Dashboard > Settings > Environment Variables
# Agregar:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - NEXT_PUBLIC_RESEND_API_KEY

# 4. Deploy inicial (opcional, se hace automático en push a main)
pnpm dlx vercel deploy
```

### Parte 6: Commit Inicial

```bash
# 1. Verificar estado
git status

# 2. Agregar todos los cambios
git add .

# 3. Commit inicial (Conventional Commits)
git commit -m "chore(project): initialize monorepo with Next.js, Supabase, and testing stack"

# 4. Push a GitHub
git push -u origin main
git push -u origin develop

# 5. Crear ramas de feature para cada squad
git checkout -b feature/squad-2-authentication
git push -u origin feature/squad-2-authentication

# Repetir para cada squad...
```

---

## 8 ✅ Checklist de Commits Requeridos por Squad (MVP Fase 1)

Para validar que **cada miembro hizo contribuciones reales**, cada squad debe cumplir:

### Squad 2 (Auditoría) - Alexander, Alan, Wallmach, Erick
- [ ] Alexander: `feat(squad-2): create profiles table and RBAC system` + 1 más
- [ ] Alan: `feat(squad-2): implement signup and password validation` + 1 más
- [ ] Wallmach: `feat(squad-2): add MFA TOTP implementation` + 1 más
- [ ] Erick: `feat(squad-2): setup audit logging and triggers` + 1 más
**Mínimo:** 4 commits (1 por persona)

### Squad 4 (Notificaciones) - Fernando, Vidales, Ari, Roman
- [ ] Fernando: `feat(squad-4): initialize Resend email service` + 1 más
- [ ] Vidales: `feat(squad-4): create email templates with React Email` + 1 más
- [ ] Ari: `feat(squad-4): setup event queue and email dispatcher` + 1 más
- [ ] Roman: `feat(squad-4): build notification center UI component` + 1 más
**Mínimo:** 4 commits (1 por persona)

### Squad 3 (Citas) - Karim, Rivera, Fernan, Eduardo
- [ ] Karim: `feat(squad-3): create appointments table with validations` + 1 más
- [ ] Rivera: `feat(squad-3): build calendar widget component` + 1 más
- [ ] Fernan: `feat(squad-3): implement booking logic and collision detection` + 1 más
- [ ] Eduardo: `feat(squad-3): create appointments list view` + 1 más
**Mínimo:** 4 commits (1 por persona)

### Squad 1 (Justificaciones) - Joel, Alfonso, Aaron
- [ ] Joel: `feat(squad-1): create justifications and files tables` + 1 más
- [ ] Alfonso: `feat(squad-1): implement file upload component` + 1 más
- [ ] Aaron: `feat(squad-1): create approval workflow BPM` + 1 más
**Mínimo:** 3 commits (1 por persona)

### Squad 5 (Incidencias) - Marvin, Osmara, Kevin
- [ ] Marvin: `docs(squad-5): prepare incident dashboard specs for Phase 2`
- [ ] Osmara: `docs(squad-5): document risk severity matrix`
- [ ] Kevin: `docs(squad-5): plan KPI tracking logic`
**Nota:** Squad 5 está OUT del MVP Fase 1 (solo documentación)

### Squad 6 (Chatbot) - Alexis, Samantha, Rey, Pablo
- [ ] Alexis: `docs(squad-6): document chatbot architecture for Phase 2`
- [ ] Samantha: `docs(squad-6): prepare FAQ knowledge base structure`
- [ ] Rey: `docs(squad-6): research RAG implementation`
- [ ] Pablo: `docs(squad-6): design chatbot UI component`
**Nota:** Squad 6 está OUT del MVP Fase 1 (solo documentación)

### Staff Gerencial - Angel, Magdalena, Roberto, Jassiel, Karla
- [ ] Jassiel (Líder): `chore(core): initialize monorepo and CI/CD` + 5 más (commits por aceptaciones/merges de PR)
- [ ] Angel: `chore(infra): configure Supabase and BD migration scripts` + 2 más
- [ ] Magdalena: `chore(infra): setup billing and cloud environments` + 2 más
- [ ] Roberto: `chore(ci-cd): configure Vercel deployments` + 2 más
- [ ] Karla: `chore(docs): document dev onboarding process` + 2 más
**Mínimo:** 5 commits each

---

## 9 ⚠️ Preguntas Finales y Validación del Proyecto

Antes de empezar, responde estas preguntas críticas:

### 1. **¿Equipo confirmado?**
- [ ] Todos los 24 miembros confirmados y asignados
- [ ] Canales de comunicación establecidos (Slack/Discord/Teams)
- [ ] Horarios de reunión de syncs semanales definidos

### 2. **¿Infraestructura lista?**
- [ ] Cuentas Supabase + Vercel + GitHub creadas
- [ ] Dominio `.site` registrado (opcional para MVP)
- [ ] Budget/Billing configurado

### 3. **¿Alcance confirmado?**
- [ ] MVP Fase 1 tiene buy-in de stakeholders
- [ ] Fases 2 y 3 documentadas pero NO comprometidas
- [ ] Features out of scope documentadas en backlog

### 4. **¿Riesgos identificados?**
- [ ] Squad 2 (Auditoría) es bloqueante → Asignar recursos Sr.
- [ ] Testing E2E requiere ambiente de staging 24/7
- [ ] Supabase Free Tier tiene límites → Plan upgrade en Fase 2

### 5. **¿Testing strategy aceptada?**
- [ ] Unit tests (Vitest) obligatorios para toda lógica core
- [ ] E2E tests (Playwright) para user journeys críticos
- [ ] RLS testing (pgTAP) para auditoría
- [ ] Load testing antes de Prod (100 usuarios mín.)

---

**🚀 PRÓXIMO PASO:** Confirma la información anterior y estamos listos para iniciar Sprint 0. ¿Alguna pregunta o ajuste antes de comenzar?


Zatarain es el mas raro