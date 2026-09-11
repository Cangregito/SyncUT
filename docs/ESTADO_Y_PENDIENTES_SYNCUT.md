# Estado de SyncUT y pendientes

Consolidación: 11 de septiembre de 2026.

## Base de trabajo

`main` es la rama de trabajo consolidada. Las ramas `feature/squad-*` y `develop` siguen existiendo tal cual: no se crearon etiquetas de archivo ni se retiró ninguna rama. Si se decide limpiarlas, conviene etiquetarlas primero (`archive/<fecha>/<rama>`); `feature/squad-2-authentication` contiene cambios antiguos de carga masiva que no forman parte de la versión auditada.

Se reúnen las correcciones existentes de autenticación demo, navegación por permisos, tema claro, justificaciones, citas, notificaciones, incidencias y Lumi, junto con las pruebas y documentación. Esto no significa que todos esos módulos estén completamente corregidos. El detalle de cada hallazgo está en [la revalidación](REVALIDACION_AUDITORIA_SYNCUT_2026-09-11.md).

Node está alineado en 22. Los vínculos locales de Vercel apuntan a `sync-ut`; los comandos de despliegue se ejecutan desde la raíz y el proyecto usa `apps/web` como Root Directory. Los vínculos de Vercel y archivos de entorno no se versionan.

Las capturas, grabaciones y herramientas personales de tutoriales se conservan localmente. No son parte del código de la plataforma publicado en este commit. Las capturas citadas por la auditoría son evidencia local; no se publican imágenes de expedientes o directorios en el repositorio público.

## Validación de la versión auditada

- Build de Next y TypeScript correctos.
- ESLint: sin errores, una advertencia de fuente personalizada.
- Vitest: 58 pruebas aprobadas; 51 inspeccionan código fuente y no sustituyen pruebas de integración.
- Desbordamiento móvil medido en Chromium sobre el build de producción: `/justificaciones` a 390 px y `/admin`, `/admin/logs`, `/admin/proyecto` a 320 px sin overflow de documento ni de `main`.
- Navegación y pruebas adicionales en Chromium, con los límites descritos en la revalidación.

El push no aplica SQL en Supabase. El sitio publicado y los despliegues automáticos de Vercel deben comprobarse por separado; no se debe inferir su estado a partir del estado de Git.

## Pendientes para decidir el siguiente trabajo

1. ~~**Respuesta del alumno y evidencias**~~ — resuelto: `serverActions.bodySizeLimit` en 10 MB, error de registro de evidencia gestionado (se retira el archivo huérfano de Storage y se pide reintentar sobre el mismo folio).
2. ~~**Notificaciones**~~ — resuelto: “Abrir trámite” filtra por `id` cuando recibe un UUID (y sanea comas/paréntesis del texto libre); una página fuera de rango redirige a la última real.
3. **Base de datos y permisos:** revisar, probar y aplicar las tres migraciones pendientes: `20260911000001_harden_emit_notification.sql`, `20260911000002_scope_appointment_rpcs_to_owner.sql` y `20260911000003_student_responds_to_info_request.sql`. Revisar además permisos por evento, cuentas suspendidas, UPDATE directo de citas y capacidades académicas de admin. Versionar el SQL no cierra B2, B3 ni D3 en producción.
4. **Acceso demo:** rotar las credenciales anteriores y definir cuentas, privilegios y habilitación del entorno de exposición.
5. **Citas:** cerrar asistencia y estado coherentemente, resolver solapamientos visuales, unificar reglas con equipo tutorial y mostrar errores en todas las acciones.
6. **Responsive y recuperación:** el desbordamiento está resuelto y medido (causas: columna flex sin `min-w-0`, chip de evidencia con nombre de archivo sin espacios, rejillas del observatorio sin columna base); el login ya muestra el motivo recibido por `?error=` (cuenta inactiva, callback de recuperación fallido). Pendiente: mejorar foco, etiquetas y legibilidad.
7. **Flujo por rol:** orientar el inicio a la próxima acción, simplificar listas y preferencias, conservar contexto del equipo y completar términos y enlaces restantes.
8. **Lumi e incidencias:** completar la atención humana de escalaciones y unificar la lógica de incidencias entre API y pantalla.
9. **Observatorio y expo:** separar avance técnico de salud operativa, identificar datos estáticos/errores de lectura y preparar un caso coherente de alumno → tutor → docente con entrega y acuse.
10. **Mantenimiento / M6:** actualizar tipos y contratos, reformatear y dividir páginas extensas, y añadir pruebas de comportamiento, integración y permisos.

Estos puntos permanecen abiertos. La consolidación no introduce sus soluciones ni aplica migraciones.
