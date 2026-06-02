# Equipo 4 - Notificación por correo

## Integrantes
- Fernando
- Vidales
- Ari
- Roman

## Misión del módulo
Diseñar y construir el motor centralizado de mensajería asíncrona para automatizar envíos de correos electrónicos y alertas institucionales.

## Alcance funcional
- Envío de correo transaccional y notificaciones operativas.
- Gestión de plantillas de correo.
- Cola de procesamiento asíncrono de mensajes.
- Registro de estado de entrega y errores.

## Entregables mínimos
- Servicio de notificaciones por correo.
- Plantillas base (bienvenida, aviso de cita, cambio de estatus).
- Centro de notificaciones en aplicación.
- Registro de eventos de envío.

## Dependencias
- Bloqueo principal: Equipo 2 (autenticación y contexto de usuario).
- Integración principal: Equipos 1, 3, 5 y 6 como productores de eventos.

## Rutas y carpetas propietarias
- `apps/web/app/(notificaciones)/`
- `packages/shared/`
- `supabase/migrations/`
- `docs/squad-4-notificaciones/`

## Variables de entorno
Usar variables en `.env.local` sin exponer llaves reales en documentación.

