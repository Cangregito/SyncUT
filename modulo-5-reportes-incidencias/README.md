# Modulo 5 - Reportes de Incidencias

## Objetivo del modulo
En este modulo se desarrollara el sistema de buzon de quejas, reportes y alertas mediante un tablero visual tipo semaforo.

## Tablas de base de datos que utilizaremos

### 1) `public.profiles` (existente)
**Uso en modulo 5:**
- Identificar a quien reporta una incidencia.
- Identificar responsables de atencion y seguimiento.
- Mostrar datos de usuario en el tablero.

**Campos clave:**
- `id` (PK)
- `email`
- `full_name`
- `role`

### 2) `public.incidents`
**Uso en modulo 5:**
- Tabla principal del buzon para registrar quejas, reportes y alertas.

**Campos sugeridos:**
- `id` uuid PK
- `reporter_id` uuid FK -> `public.profiles(id)`
- `teacher_id` uuid FK -> `public.profiles(id)` (profesor reportado)
- `group_code` text (grupo del alumno que reporta)
- `incident_type` text (`queja`, `reporte`, `alerta`)
- `title` text
- `description` text
- `priority` text (`baja`, `media`, `alta`, `critica`)
- `semaphore_status` text (`verde`, `amarillo`, `rojo`)
- `status` text (`abierta`, `en_proceso`, `resuelta`, `cerrada`)
- `location` text
- `created_at` timestamptz
- `updated_at` timestamptz

### 3) `public.incident_assignments`
**Uso en modulo 5:**
- Asignar incidencias a personal responsable.

**Campos sugeridos:**
- `id` uuid PK
- `incident_id` uuid FK -> `public.incidents(id)`
- `assigned_to` uuid FK -> `public.profiles(id)`
- `assigned_by` uuid FK -> `public.profiles(id)`
- `assigned_at` timestamptz
- `active` boolean

### 4) `public.incident_updates`
**Uso en modulo 5:**
- Registrar seguimiento (bitacora) por cada incidencia.

**Campos sugeridos:**
- `id` uuid PK
- `incident_id` uuid FK -> `public.incidents(id)`
- `updated_by` uuid FK -> `public.profiles(id)`
- `comment` text
- `status_before` text
- `status_after` text
- `semaphore_before` text
- `semaphore_after` text
- `created_at` timestamptz

### 5) `public.incident_attachments`
**Uso en modulo 5:**
- Guardar evidencias (imagenes, documentos, etc.).

**Campos sugeridos:**
- `id` uuid PK
- `incident_id` uuid FK -> `public.incidents(id)`
- `file_url` text
- `file_name` text
- `file_type` text
- `uploaded_by` uuid FK -> `public.profiles(id)`
- `created_at` timestamptz

### 6) `public.incident_alert_rules`
**Uso en modulo 5:**
- Definir reglas para alertas automaticas y cambio de color en el semaforo.

**Campos sugeridos:**
- `id` uuid PK
- `name` text
- `incident_type` text
- `priority` text
- `max_response_minutes` integer
- `target_semaphore` text (`verde`, `amarillo`, `rojo`)
- `active` boolean
- `created_at` timestamptz

### 7) `public.incident_notifications`
**Uso en modulo 5:**
- Registrar notificaciones enviadas por el sistema (correo, push, etc.).

**Campos sugeridos:**
- `id` uuid PK
- `incident_id` uuid FK -> `public.incidents(id)`
- `recipient_id` uuid FK -> `public.profiles(id)`
- `channel` text (`email`, `push`, `in_app`)
- `message` text
- `sent_at` timestamptz
- `delivery_status` text

## Reglas de semaforo sugeridas (semanal, por grupo y profesor)
El semaforo se calcula por **cada profesor en cada semana**, usando el porcentaje de alumnos del grupo que metieron al menos una queja contra ese profesor.

Formula:
$$
	ext{porcentaje\_queja} = \frac{\text{alumnos\_que\_se\_quejaron\_del\_profe\_en\_la\_semana}}{\text{total\_alumnos\_del\_grupo}} \times 100
$$

- **Verde:** porcentaje menor a 20%.
- **Amarillo:** porcentaje entre 20% y 50% (incluyendo limites).
- **Rojo:** porcentaje mayor a 50%.

Ejemplo: grupo de 40 alumnos, en la semana 22 se quejan 22 del mismo profesor:
$\frac{22}{40} \times 100 = 55\%$ -> semaforo **rojo**.

## Flujo resumido del modulo
1. Usuario crea incidencia en el buzon (`incidents`).
2. El sistema asigna responsable (`incident_assignments`).
3. Se registran avances (`incident_updates`).
4. Se actualiza color del tablero segun reglas (`incident_alert_rules`).
5. Se notifican cambios relevantes (`incident_notifications`).

## Nota para el equipo
Este documento define las tablas base para el modulo 5. Antes de implementar, se recomienda validar tipos, indices y politicas RLS con el resto de modulos.
