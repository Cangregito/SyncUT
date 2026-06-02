# Modulo dashboard principal

## Modelo de ownership
Modulo integrador sin equipo exclusivo.

La implementacion se mantiene compartida entre lideres de modulo para garantizar acceso coherente a:
- Equipo 1: Justificaciones.
- Equipo 3: Citas.
- Equipo 4: Notificaciones.
- Equipo 5: Incidencias.
- Equipo 6: Chatbot.

## Objetivo
Presentar, despues del login, una vista central con accesos y resumen por rol de usuario.

## Funciones del modulo
- Mostrar modulos habilitados por rol.
- Exponer resumen operativo y accesos rapidos.
- Centralizar navegacion a todos los modulos funcionales.

## Dependencias
- Bloqueo principal: Equipo 2 (autenticacion y roles).
- Integracion funcional: Equipos 1, 3, 4, 5 y 6.

## Carpeta de trabajo
- `apps/web/app/(dashboard)/`

