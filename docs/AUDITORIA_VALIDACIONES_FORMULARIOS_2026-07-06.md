# Auditoria de validaciones de formularios

Fecha: 2026-07-06  
Produccion: https://sync-ut.vercel.app

## Objetivo

Revisar modulo por modulo que los formularios no permitan datos incoherentes y que las reglas importantes vivan en tres capas:

- UI: el usuario ve solo los campos que aplican.
- Servidor: las server actions/API rechazan datos invalidos aunque alguien manipule el HTML.
- Base de datos: las restricciones evitan guardar estados contradictorios.

## Citas con tutor

### Regla de modalidad

| Modalidad | Campo permitido | Campo prohibido |
| --- | --- | --- |
| Presencial | Aula o lugar | URL de reunion |
| En linea | URL de reunion | Aula o lugar |

Cambios aplicados:
- El formulario muestra condicionalmente el campo correcto.
- `createAppointment` valida en servidor:
  - presencial requiere `location` minimo 3 caracteres.
  - presencial rechaza `meeting_url`.
  - virtual requiere URL `http` o `https`.
  - virtual rechaza `location`.
  - motivo requiere minimo 10 caracteres.
- `createAvailability` valida en servidor:
  - presencial requiere aula/lugar.
  - virtual requiere URL base.
- La migracion `20260706000004_tutor_names_and_form_validations.sql` agrega checks en Supabase:
  - `appointments_modality_contact_consistency`.
  - `tutor_availability_location_required`.

## Justificaciones

Validaciones aplicadas:
- Titulo minimo 5 caracteres.
- Descripcion minimo 15 caracteres.
- Fecha fin no puede ser menor que fecha inicio.
- Evidencia debe capturarse en pareja:
  - si hay nombre de evidencia, debe haber ruta/referencia.
  - si hay ruta/referencia, debe haber nombre.
  - ambos deben tener minimo 3 caracteres cuando se usan.

Servidor validado:
- `createJustification`.

## Incidencias

Validaciones aplicadas:
- Titulo minimo 5 caracteres.
- Area minimo 3 caracteres.
- Descripcion minimo 15 caracteres.
- Resolver o cerrar exige resumen minimo de 15 caracteres.
- Cambiar a "En proceso" no exige resumen.
- La pantalla separa el boton "En proceso" del formulario de resolucion/cierre para que HTML tambien exija el resumen solo cuando corresponde.

Servidor/API validado:
- `createIncident`.
- `updateIncidentStatus`.
- `POST /api/incidencias`.
- `PATCH /api/incidencias/[id]`.

## Nombres de tutores

Se actualizo el tutor demo a nombre completo realista:

```text
Mtra. Fernanda Ruiz Hernandez
```

La migracion actualiza:
- `public.profiles.full_name`
- `auth.users.raw_user_meta_data.full_name`
- `public.teachers.department`
- `public.teachers.specialization`
- `public.teachers.office_location`

## Checklist de prueba

1. Iniciar sesion como `tutor@syncut.test`.
2. Ir a Citas.
3. Crear disponibilidad presencial y confirmar que solo aparece aula/lugar.
4. Cambiar modalidad a En linea y confirmar que solo aparece URL base.
5. Iniciar sesion como `estudiante@syncut.test`.
6. Solicitar cita presencial y confirmar que no aparece URL.
7. Solicitar cita en linea y confirmar que no aparece aula/lugar.
8. Probar justificacion con evidencia incompleta y confirmar que no se guarda.
9. Probar incidencia con descripcion corta y confirmar que no se guarda.
10. Como coordinacion, intentar resolver incidencia sin resumen y confirmar que el formulario exige texto.

## Archivos principales

| Archivo | Cambio |
| --- | --- |
| `apps/web/components/appointments/modality-details-fields.tsx` | Campos condicionales por modalidad. |
| `apps/web/app/(dashboard)/citas/page.tsx` | Validaciones de modalidad y motivo. |
| `apps/web/app/(dashboard)/justificaciones/page.tsx` | Validacion de evidencia, titulo, descripcion y fechas. |
| `apps/web/app/(dashboard)/incidencias/page.tsx` | Validacion de textos y resolucion. |
| `apps/web/app/api/incidencias/route.ts` | Validacion API para crear incidencia. |
| `apps/web/app/api/incidencias/[id]/route.ts` | Validacion API para cerrar/resolver. |
| `supabase/migrations/20260706000004_tutor_names_and_form_validations.sql` | Checks de base de datos y nombre real del tutor. |
