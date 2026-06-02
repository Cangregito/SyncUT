# Estructura de carpetas - donde programa cada equipo

## Estructura base

```text
apps/web/app/
|-- (auth)            Team 2
|-- (citas)           Team 3
|-- (justificaciones) Team 1
|-- (notificaciones)  Team 4
|-- (incidencias)     Team 5
|-- (chatbot)         Team 6
`-- (dashboard)       Integracion compartida
```

## Modulo por equipo

### Team 1 - Justificaciones
- Ruta: apps/web/app/(justificaciones)/
- Entrega: registro de faltas, conversion de retardos, solicitud de justificacion, carga de evidencia.
- Bloqueo: Team 2.
- Integracion: Team 4.

### Team 2 - Autenticacion y auditoria
- Ruta: apps/web/app/(auth)/
- Entrega: login, signup, sesion, roles, control de acceso, trazabilidad.
- Bloqueo: ninguno.
- Desbloquea: Teams 1, 3, 4, 5, 6.

### Team 3 - Citas con tutor
- Ruta: apps/web/app/(citas)/
- Entrega: agenda, gestion y seguimiento de sesiones de tutoria.
- Bloqueo: Team 2.
- Integracion: Team 4.

### Team 4 - Notificaciones por correo
- Ruta: apps/web/app/(notificaciones)/
- Entrega: motor asincrono de mensajes y alertas institucionales.
- Bloqueo: Team 2.
- Recibe eventos: Teams 1, 3, 5, 6.

### Team 5 - Reporte de incidencias
- Ruta: apps/web/app/(incidencias)/
- Entrega: buzon de quejas, reportes y tablero semaforo.
- Bloqueo: Team 2.
- Integracion: Team 4.

### Team 6 - Chatbot
- Ruta: apps/web/app/(chatbot)/
- Entrega: atencion automatizada para dudas estudiantiles.
- Bloqueo: Team 2.
- Integracion: Team 4.

### Dashboard compartido
- Ruta: apps/web/app/(dashboard)/
- Funcion: punto de entrada e integracion de modulos por rol.
- Dependencia critica: Team 2.

## Documentacion obligatoria

Cada modulo debe mantener su README con:
- Equipo responsable e integrantes.
- Objetivo del modulo.
- Funciones incluidas.
- Dependencias y bloqueos.
- Ruta oficial de trabajo.
