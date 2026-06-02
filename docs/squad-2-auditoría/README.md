# Equipo 2 - Autenticación y auditoría

## Integrantes
- Alexander
- Alan
- Wallmach
- Erick

## Misión del módulo
Diseñar e implementar la capa transversal de seguridad, control de acceso y trazabilidad para toda la plataforma.

## Alcance funcional
- Login, signup y manejo de sesión.
- Gestión de perfiles y roles.
- Reglas de acceso con RLS en base de datos.
- Auditoría inmutable de eventos sensibles.
- Protección de rutas y middleware de seguridad.

## Entregables mínimos
- Flujo de autenticación funcional end-to-end.
- Tablas base de perfiles, tokens y auditoría en Supabase.
- Policies RLS revisadas y documentadas.
- Contrato de roles/permisos consumible por los demás equipos.

## Dependencias
- Ninguna para iniciar.
- Este equipo desbloquea a Equipos 1, 3, 4, 5 y 6.

## Rutas y carpetas propietarias
- `apps/web/app/(auth)/`
- `supabase/migrations/`
- `packages/sdk/`
- `packages/types/`
- `docs/squad-2-auditoría/`
