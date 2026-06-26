# SyncUT

Plataforma universitaria modular construida con Next.js, Supabase y Turborepo.

## Estado

El núcleo de plataforma proporciona autenticación, perfiles, roles, protección de
rutas y contratos compartidos. La lógica funcional de cada módulo pertenece a
su squad responsable.

Consulta [docs/PLATFORM_CORE.md](docs/PLATFORM_CORE.md) para conocer ownership,
reglas de integración, seguridad y comandos de trabajo.

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

## Calidad

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:test
pnpm db:test:security
```
