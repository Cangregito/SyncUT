# SyncUT Platform Core

## Responsabilidad del núcleo

El núcleo entrega infraestructura transversal y contratos estables:

- Supabase Auth con sesión en cookies.
- Perfil y rol obtenidos desde `public.profiles`.
- Protección de rutas mediante `proxy.ts` y layouts de servidor.
- Autorización administrativa validada en servidor.
- Helpers RLS `is_admin()` y `has_role(...)`.
- Asignación de roles exclusivamente mediante `set_user_role(...)`.
- Tipos compartidos y registro de ownership de módulos.
- CI, migraciones y convenciones de integración.

El núcleo no implementa reglas de negocio internas de los módulos.

## Contrato para squads

Cada squad recibe:

1. Una ruta autenticada dentro de `apps/web/app/(dashboard)`.
2. Un usuario de Supabase válido.
3. Un perfil con `id`, `email`, `full_name` y `role`.
4. Tipos de base de datos en `@plataforma/types`.
5. Contratos de ownership en `@plataforma/sdk/contracts`.
6. Migraciones versionadas y RLS obligatorio.

Cada squad debe entregar:

1. Migraciones aditivas para sus tablas.
2. Policies RLS probadas por rol.
3. Reglas de negocio y validación.
4. UI y estados de error/carga.
5. Pruebas unitarias, integración y E2E de su módulo.
6. Eventos publicados al módulo de notificaciones cuando corresponda.

## Reglas de seguridad

- Nunca guardar contraseñas, tokens o roles en `localStorage`.
- Nunca confiar en `user_metadata` para permisos.
- Nunca usar `SUPABASE_SERVICE_ROLE_KEY` en componentes cliente.
- Nunca exponer secretos con prefijo `NEXT_PUBLIC_`.
- Los cambios de rol deben usar `public.set_user_role`.
- Toda tabla de módulo debe habilitar RLS antes de integrarse.

## Flujo local

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:test
pnpm db:test:security
```

Para revisar migraciones remotas:

```bash
pnpm dlx supabase@latest migration list
```

No ejecutar `supabase db push` hasta revisar el SQL y las diferencias remotas.
