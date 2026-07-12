# SyncUT

Plataforma universitaria modular construida con Next.js, Supabase y Turborepo.

## Estado

El núcleo de plataforma proporciona autenticación, perfiles, roles, protección de
rutas y contratos compartidos. La lógica funcional de cada módulo pertenece a
su squad responsable.

Consulta [docs/PLATFORM_CORE.md](docs/PLATFORM_CORE.md) para conocer ownership,
reglas de integración, seguridad y comandos de trabajo.

Documentacion funcional reciente:

- [Auditoria de roles y flujo real](docs/AUDITORIA_ROLES_FLUJO_REAL_2026-07-06.md): responsabilidades por rol, permisos refinados, cuentas demo y checklist de produccion.
- [Auditoria de validaciones de formularios](docs/AUDITORIA_VALIDACIONES_FORMULARIOS_2026-07-06.md): reglas de modalidad, evidencia, incidencias y checks de base de datos.
- [Auditoria de cambios de modulos en produccion](docs/AUDITORIA_CAMBIOS_MODULOS_PRODUCCION.md).
- [Auditoria funcional de tutorias](docs/AUDITORIA_FUNCIONAL_MODULOS_TUTORIAS.md).

## Inicio rápido

```bash
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Variables mínimas:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

En producción, la URL canónica es `https://syncut.click`. Configura
`NEXT_PUBLIC_APP_URL=https://syncut.click` en Vercel; `localhost` se reserva
únicamente para desarrollo local.

## Calidad

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:test
pnpm db:test:security
```
```## Prueba de Front End

Se realizó una prueba de integración para el desarrollo del Front End.
