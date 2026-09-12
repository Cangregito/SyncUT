# Correr SyncUT completo en localhost

Sirve para demostrar la plataforma sin depender de Supabase en la nube
(por ejemplo, si el servicio de autenticación está degradado el día de la expo).

## Requisitos

- Docker Desktop abierto.
- Node 22 y pnpm (ya instalados en el repo).

## 1. Levantar Supabase local

```bash
cd supabase
pnpm exec supabase start
```

La primera vez descarga las imágenes (varios minutos). Al terminar aplica las
57+ migraciones, crea los buckets y siembra las cuentas demo. Datos útiles:

- API: `http://127.0.0.1:54321`
- Studio (explorador de la base): `http://127.0.0.1:54323`
- Correo de prueba (Mailpit): `http://127.0.0.1:54324`

Para detenerlo: `pnpm exec supabase stop` (conserva los datos) o
`pnpm exec supabase stop --no-backup` (los borra).

## 2. Apuntar la app a Supabase local

Crea `apps/web/.env.local` con las claves que imprime `supabase start`
(o `pnpm exec supabase status`):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
SUPABASE_SECRET_KEY=<SERVICE_ROLE_KEY>
NEXT_PUBLIC_APP_URL=http://localhost:3000
GROQ_API_KEY=<misma clave que en la nube, para Lumi>
GROQ_MODEL=<mismo modelo>
```

Ese archivo está ignorado por git. Para volver a la nube, bórralo y recompila.

## 3. Arrancar la app

```bash
cd apps/web
pnpm exec next build && pnpm exec next start -p 3000
# o, para desarrollo con recarga: pnpm exec next dev -p 3000
```

Abre `http://localhost:3000/login`.

## Cuentas demo

| Rol | Correo | Contraseña |
|---|---|---|
| Estudiante | estudiante@syncut.test | SyncUT2026! |
| Tutor | tutor@syncut.test | SyncUT2026! |
| Docente | docente@syncut.test | SyncUT2026! |
| Administrador | admin@syncut.test | SyncUT2026! |

## Nota sobre privilegios

Las imágenes recientes de Postgres de Supabase no conceden acceso a las tablas
de `public` a los roles de la API por defecto. La migración
`20260912000001_grant_api_roles_on_public_tables.sql` lo deja explícito; sin
ella un entorno nuevo falla con `permission denied for table ...` al entrar.
