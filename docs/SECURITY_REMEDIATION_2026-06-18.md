# Security remediation — 2026-06-18

## Hallazgo crítico

`NEXT_PUBLIC_SUPABASE_ANON_KEY` contenía una clave legacy con rol
`service_role`. Al usar el prefijo `NEXT_PUBLIC_`, Next.js podía incluirla en
el navegador y permitir omitir RLS.

## Acciones completadas

- La configuración local usa ahora la clave `publishable`.
- Vercel Production usa la clave `publishable`.
- Las ramas Preview existentes usan la clave `publishable`.
- Se desplegó una nueva versión de producción.
- Se eliminó la política remota `Permitir lectura de perfiles`.
- El rol `anon` perdió acceso a `profiles` y a los RPC internos.
- Se probaron registro con mínimo privilegio y bloqueo de autoelevación.

## Revocación completada

El 18 de junio de 2026 se completaron estas acciones en Supabase Dashboard:

1. Se deshabilitaron las Legacy API Keys.
2. Se revocó la clave de firma JWT Legacy HS256.
3. Se comprobó que la antigua `service_role` falla como API key y como JWT.
4. Se eliminó `SUPABASE_SERVICE_ROLE_KEY` de Vercel.
5. Se conservaron únicamente despliegues construidos después de la corrección.

## Verificación

```bash
pnpm db:test
pnpm db:test:security
pnpm dlx supabase@latest db lint --linked --level warning
```

Resultados esperados:

- La API anónima recibe `401` al consultar `profiles`.
- La API anónima recibe `401` al ejecutar `is_admin`.
- Metadata con `role: admin` produce un perfil `student`.
- Un estudiante no puede modificar su rol ni ejecutar `set_user_role`.
