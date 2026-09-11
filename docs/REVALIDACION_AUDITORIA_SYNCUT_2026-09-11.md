# Revalidación de la auditoría de SyncUT

Fecha: 11 de septiembre de 2026. Revisión del código local, build de producción ejecutado localmente, Supabase remoto y sitio público `syncut.click`.

**Resultado:** existen mejoras comprobables, pero no corresponde dar por cerrada la auditoría. Varias correcciones funcionan localmente; otras son parciales o dependen de migraciones pendientes. El dominio público continúa sirviendo el despliegue del 13 de julio y conserva problemas que ya se corrigieron en esta copia de trabajo.

Este documento conserva los identificadores F01–F08 y U01–U05 del diagnóstico inicial. Las referencias B/D/A/M corresponden, cuando se conocen, a los nombres de las pruebas añadidas por el otro agente. Los identificadores S/O/C se incorporan aquí para poder dar seguimiento a los hallazgos de seguridad, observatorio y configuración que antes estaban descritos sin identificador.

## Cómo interpretar el estado

- **Corregido localmente:** comprobado en el código actual y, cuando corresponde, en navegador; todavía requiere publicación para llegar al sitio público.
- **Mejorado / parcial:** una parte cambió, pero queda trabajo para resolver el hallazgo completo.
- **Pendiente:** el problema persiste o no se hizo una corrección suficiente.
- **Pendiente de migración:** hay SQL local, pero la base conectada aún no tiene el cambio registrado/aplicable.
- **No verificado de extremo a extremo:** existe implementación, pero no se ejecutó una transacción completa contra datos reales.

No se aplicaron migraciones, desplegó el frontend, modificaron roles ni enviaron solicitudes/comunicaciones de negocio. Los inicios de sesión usados para la auditoría generan los eventos de autenticación normales. Las pruebas de escritura del formulario inicial interceptaron las peticiones al backend y devolvieron respuestas simuladas. La prueba del adjunto grande del nuevo formulario usó un identificador vacío, que impide llegar a sus escrituras si la petición supera la validación de tamaño.

## 1. Estado de producción y del mensaje del otro agente

| Afirmación / comprobación | Resultado actual |
|---|---|
| “No tienes la CLI de Supabase instalada” | **Incorrecto.** Está disponible como `pnpm exec supabase`, versión 2.108.0, autenticada y vinculada a SyncUT. |
| “Faltan tres migraciones” | **Confirmado.** `supabase migration list --linked` muestra 54 migraciones coincidentes y tres nuevas sólo en local. |
| “El RPC de respuesta todavía no existe” | **Confirmado.** Consulta GET de existencia con un UUID vacío devolvió HTTP 404 / `PGRST202` para `respond_to_justification_info_request`. No se envió una respuesta real. |
| “B2, B3 y D3 siguen abiertos en producción” | **Correcto.** Además del SQL pendiente, las correcciones de frontend aún no se publicaron en el dominio principal. |
| “M6 se dejó pendiente” | **Confirmado.** Persisten páginas con líneas muy extensas y mezcla de responsabilidades. Su prioridad es inferior a los fallos de flujo. |
| “Sin entorno DOM sólo se verificó código fuente” | Describe las pruebas que añadió ese agente, no una imposibilidad de verificar el producto. En esta revisión se ejecutó Chromium/Playwright y se inspeccionaron capturas nuevas y comportamiento real. |
| Vercel / dominio público | `syncut.click` apunta a `sync-ut`, despliegue `dpl_CQ71iZ1RGdiiHCTKKURM3QVXcLyZ`, estado Ready, creado el 13 de julio de 2026. |

Las migraciones pendientes son:

| Archivo | Qué pretende corregir | Evaluación |
|---|---|---|
| `20260911000001_harden_emit_notification.sql` | B2: validar relación con destinatario y fijar el actor desde la sesión. | Mejora el diseño, pero falta desplegar y comprobar permisos por evento y estado activo; no basta para declarar cerrada toda la emisión de avisos. |
| `20260911000002_scope_appointment_rpcs_to_owner.sql` | B3: tutor propietario y cuenta activa en los RPC de citas. | Corrección específica implementada en SQL, pendiente de aplicar/probar. Conserva acceso académico de admin y no cambia las políticas de actualización directa de la tabla. |
| `20260911000003_student_responds_to_info_request.sql` | D3: respuesta del alumno y retorno a revisión sobre el mismo folio. | Pendiente de aplicar. El formulario nuevo tiene además problemas de tamaño de adjuntos y manejo de errores de evidencia. |

No es necesario proporcionar nuevas credenciales para conectar. El acceso ya está validado. No debe confundirse “aplicar las tres migraciones” con “cerrar todos los hallazgos”: siguen existiendo problemas de código y UX independientes del SQL.

Los dos ajustes de configuración solicitados después de la auditoría se mantienen corregidos:

| ID | Punto | Estado comprobado |
|---|---|---|
| C01 | Vinculación de Vercel | **Corregido.** Tanto la raíz como `apps/web/.vercel/project.json` apuntan a `sync-ut`. El proyecto remoto conserva `apps/web` como Root Directory; los despliegues deben iniciarse desde la raíz del repositorio. |
| C02 | Versión de Node | **Corregido.** Vercel usa 22.x, en consonancia con `engines` y `.nvmrc` 22. No se generó un despliegue nuevo para esta comprobación. |
| C03 | Acceso desde las CLI | **Operativo.** Supabase está autenticado y vinculado; Vercel permite consultar el proyecto, sus variables y el despliegue público. |

## 2. Revisión de todos los hallazgos funcionales originales

| ID original | Hallazgo | Estado | Explicación y trabajo restante |
|---|---|---|---|
| **F01 / D1** | Error después de guardar una justificación | **Corregido localmente** | El formulario conserva `const form = event.currentTarget` antes de los `await`, usa `form.reset()` y captura excepciones. Con éxito simulado se confirmó mensaje de éxito, campos reiniciados y ausencia del TypeError original. Producción sigue con el despliegue anterior. |
| **F02 / D3** | Solicitud de información sin salida para el alumno | **Parcial; migración pendiente** | Existe formulario de respuesta, nota y evidencia sobre el mismo folio. El RPC remoto no existe todavía. El adjunto de 2 MB rompe la petición; los errores al guardar metadata no se controlan. El caso de solicitud nueva en `pending` cuyo adjunto falló sigue sin una vía directa de reparación por el alumno. |
| **F03 / D2, A5** | Disponibilidad y reserva incoherentes | **Mejorado / parcial** | La cita hereda modalidad/lugar del bloque y permite fines de semana publicados. Se seleccionó sábado 12/09, 19:00–20:00, con aula heredada. La solicitud incompleta ahora explica qué falta. Persisten comparación de ocupación por bloque exacto, salidas silenciosas en otras acciones, fechas/horas pasadas del mismo día y cierre de cita sin asistencia. |
| **F04 / A1, A2, A8** | Controles y destinos sin función | **Mejorado / parcial** | Se retiraron buscador global, casilla de sesión y enlaces `#` del acceso. La campana depende del permiso y conteo; admin ya no tiene ese destino incorrecto. El roadmap tiene ancla. Sigue mal ubicada el ancla de preferencias y quedan comandos decorativos del observatorio. Registro pide aceptar términos que todavía no se pueden consultar. |
| **F05** | Inicio sin siguiente paso claro por rol | **Pendiente** | El cambio es principalmente de redacción. Persisten KPI genéricos de estudiantes/docentes que vuelven al mismo dashboard; no se destaca la incorporación al equipo ni la próxima acción personal. La página docente conserva tarjetas que conducen a rutas redirigidas. |
| **F06 / A3, A4** | Notificaciones poco accionables y excesivas | **Mejorado / parcial** | Hay páginas de 20 avisos y botones “Abrir trámite”. La altura del estudiante bajó de 37 204 a 7 151 px en escritorio. Sin embargo, el enlace a justificación busca su UUID en título/descripción y devuelve lista vacía. Citas/incidencias sólo abren el módulo. Permanecen 33 formularios de preferencias y los totales superiores ahora describen sólo la página. |
| **F07 / A6** | Escalamiento de Lumi incompleto | **Mejorado / parcial** | Se incorporó escalamiento en la rama IA y bandeja de pendientes para tutor. En la muestra hay 15 casos; sólo se ofrece “Marcar atendida”, sin abrir conversación, identificar claramente al solicitante, responder o notificar una resolución. Continúan disponibilidad fija, FAQ sin acciones, Markdown literal y ausencia de estado de envío en el chat. |
| **F08 / D6** | API de incidencias desalineada con la pantalla | **Mejorado / parcial** | El POST ahora resuelve `team_id` desde la membresía activa, y las API ocultan detalles crudos de PostgreSQL. Siguen dos implementaciones separadas, sin equivalencia completa de atributos, auditoría y eventos. No se creó una incidencia real desde la API para certificar el recorrido completo. |

### Detalles de F02 que impiden cerrarlo

1. `respondToInfoRequest` inserta `justification_files` sin comprobar el error. Puede mover el estado aunque no quede registrado el archivo, una vez exista el RPC.
2. El formulario inicial mantiene el mismo patrón. Una prueba aislada simuló éxito de subida y rechazo de metadata: aun así apareció “Justificacion enviada correctamente”.
3. No hay control visible suficiente de tipo/tamaño antes de enviar. El nuevo formulario pasa por Server Actions y hereda el límite de 1 MB de Next; Storage permite más. Un archivo de 2 MB produjo HTTP 500 visible y `Body exceeded 1 MB limit` en servidor.
4. La nueva función SQL valida propietario/estado/nota, pero no comprueba `account_status`. Ese control debe estar dentro de la función si la RPC es accesible con una sesión todavía válida de una cuenta suspendida.
5. La ventana de fechas del formulario inicial mantiene la discrepancia entre el máximo calculado del campo final y la validación relativa a hoy.

### Detalles de F03 que siguen pendientes

- El cliente aún compara `fecha|inicio|fin` exactos para decidir si está ocupado; un solapamiento parcial puede seguir apareciendo disponible. La defensa SQL no sustituye la explicación en el calendario.
- `updateAppointmentStatus`, `createAvailability`, `deactivateAvailability` y parte de asistencia/seguimiento mantienen retornos silenciosos o errores sólo en consola.
- El botón “Completar” sigue separado de registrar asistencia; después de completar desaparece el formulario de asistencia.
- Se sigue mostrando todo el historial, con fechas ascendentes y disponibilidad repetida dentro de cada tarjeta. Los enlaces de reunión se muestran como texto.
- La creación de cita desde equipo tutorial sigue siendo una implementación separada con reglas distintas.

## 3. Revisión de UI, responsive y accesibilidad

| ID original | Hallazgo | Estado | Explicación y trabajo restante |
|---|---|---|---|
| **U01 / D4, D5** | Contraste roto y dos mecanismos de tema | **Corregido localmente en el caso reportado** | `@custom-variant dark` sigue `data-theme` y las tres portadas usan `.admin-hero` con superficie clara/oscura. Se accionó el botón real de tema, esperó su transición y comprobó texto legible en gobernanza, logs y avance. Producción aún muestra encabezados oscuros con texto oscuro. No equivale a certificar todos los contrastes de la app. |
| **U02** | Desbordamientos móviles | **Pendiente, con mejora parcial en admin** | Justificaciones sigue necesitando **468 px** en un viewport de **390 px**. Administración a 320 px bajó de 344 a **324 px**, pero todavía desborda. Los otros seis módulos del estudiante no desbordaron a 390 px; admin fue correcto a 768 px. |
| **U03 / A3** | Páginas demasiado extensas | **Mejorado / parcial** | Notificaciones ahora se pagina. Justificaciones/incidencias tienen límite de 50, pero no una paginación para recorrer el resto; sus datos auxiliares siguen consultándose extensamente. La agenda y equipo tutorial conservan estructura y longitud. |
| **U04 / M3** | Lenguaje técnico e inconsistencias visuales | **Mejorado / parcial** | Cambiaron encabezados, desaparecieron etiquetas Squad del sidebar académico y el título del navegador ahora identifica SyncUT. Aún hay “Squad” en tarjetas del dashboard, `public.incidents` en incidencias y mensajes técnicos en estados de error. Continúan abreviaturas, estados en inglés, tildes ausentes y formatos dispares. |
| **U05** | Teclado, foco y legibilidad | **Mejorado / parcial** | Escape cierra el menú móvil y el fondo bloquea el scroll mientras está abierto. Falta gestión completa del foco y nombres accesibles en los botones de abrir/cerrar drawer. Persisten textos de 9–11 px y controles/placeholder con legibilidad mejorable. No se ejecutó una evaluación completa WCAG ni con lector de pantalla. |

**Evidencia local — Paso 11: logs en el tema claro corregido localmente:** `local-light-admin-logs.png`.

**Evidencia local — Paso 12: justificaciones aún recortadas a 390 px:** `mobile-student-justificaciones.png`.

## 4. Seguridad, configuración y mantenibilidad

Los puntos siguientes corresponden, en el mismo orden, a la tabla de permisos/configuración/mantenibilidad del diagnóstico inicial. La revisión de permisos es estática y de consultas seguras; no se intentó modificar información de otros usuarios.

| ID de seguimiento | Hallazgo original | Estado | Explicación y trabajo restante |
|---|---|---|---|
| **S01 / B1** | Credenciales demo en cliente y acceso admin público | **Mejorado / parcial** | Se movieron al módulo `server-only`; la Server Action excluye admin y el botón público ya no aparece localmente. Sigue una contraseña fallback conocida y el acceso demo habilitado por defecto. La cuenta administrativa acepta las credenciales anteriores y el sitio público conserva el acceso anterior. Faltan rotación, política explícita del entorno demo y publicación. |
| **S02 / B3** | RPC de citas sin propiedad ni estado de cuenta | **Pendiente de migración** | El SQL nuevo comprueba tutor propietario y cuenta activa. Las funciones corregidas no están aplicadas. Además, la política actual de UPDATE directo de `appointments` sigue aceptando participantes; debe comprobarse que no permita evitar las reglas de transición de los RPC. |
| **S03 / B2** | Emisión de notificaciones sin autorización de relación/actor | **Pendiente de migración; solución parcial** | Se fija el actor de sesión y se comprueba relación. Aún no se despliega. El SQL permite cualquier tipo de evento/título/cuerpo entre usuarios relacionados, no revisa cuenta activa y devuelve NULL silenciosamente al denegar. Falta autorizar la operación concreta y hacer visible un fallo de emisión. |
| **S04** | Admin sólo gobernanza en UI, pero académico en SQL | **Pendiente** | El proxy está mejor alineado con `getModulesForRole`; esto no cambia las capacidades SQL. Incluso las nuevas funciones de citas conservan la excepción `actor_role = 'admin'`. |
| **S05 / B4** | Sonda de IA pública y costosa por petición | **Corregido localmente en acceso anónimo; protección parcial de coste** | Una solicitud sin sesión devuelve **401**. Existe caché de 60 s y promesa compartida por proceso. Sigue siendo una inferencia del proveedor para cualquier autenticado y la caché no es global entre instancias. El despliegue público es anterior. No se llamó a la sonda remota para evitar consumo innecesario. |
| **S06** | Clave privilegiada ausente localmente | **Pendiente local; configurada en producción** | `.env.local` sigue sin `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY`. Vercel sí enumera `SUPABASE_SERVICE_ROLE_KEY` en Production. No se probaron invitaciones ni cambios administrativos; presencia de variable no certifica la operación completa. |
| **S07** | Tipos de BD desactualizados y conversiones forzadas | **Pendiente** | `database.types.ts` sigue sin tablas/RPC recientes. Se encontraron 22 líneas con coerciones como `as never`, `as "notifications"` o `as "get_teacher_directory"`; las nuevas respuestas usan el mismo recurso. |
| **S08 / M6** | Páginas grandes y responsabilidades mezcladas | **Pendiente** | Admin/logs contiene una línea de 3 531 caracteres; admin llega a 1 523; docente a 1 799. Citas tiene 1 020 líneas y equipo 594. Se confirma que el reformateo/extracción no se hizo. Es mantenimiento posterior a estabilizar los flujos, no el principal bloqueo de la expo. |
| **S09** | Contratos/documentación anteriores al flujo actual | **Pendiente** | Los contratos SDK y documentos siguen describiendo roles/capacidades anteriores. No se actualizaron al mismo ritmo que las páginas y migraciones. |
| **S10** | Cobertura insuficiente | **Mejorado / parcial** | Se pasó de 7 a **48 tests**, pero los 41 nuevos inspeccionan cadenas del código fuente. No ejercitan formularios, SQL, red, concurrencia o permisos. Los fallos de enlaces y adjuntos comprobados en navegador pasan esas pruebas. |

## 5. Observatorio: seguimiento de los cinco puntos originales

| ID | Hallazgo | Estado | Explicación |
|---|---|---|---|
| **O01** | “Avance global” / “Módulos terminados” confunden pendientes con implementación | **Pendiente** | Conservan el cálculo y etiquetas. La vista cargada sigue mostrando 0% y 0/5 a pesar de los módulos funcionales. |
| **O02 / M1, M2** | Uptime, tendencias y otros valores fijos | **Mejorado / parcial** | Se retiraron uptime 99.98%, varias variaciones falsas y datos no usados. El estado online depende ahora de una lectura. Roadmap, sprints, riesgos y mejoras continúan estáticos, sin una separación suficiente de lo medido. |
| **O03** | Consultas fallidas convertidas en cero y sincronización parcial considerada correcta | **Pendiente** | `live-data.ts` no cambió: una lectura principal correcta basta para `hasLiveSource`, otras fallas terminan como cero. La nueva bandera online hereda esa limitación. |
| **O04** | Snapshot Git presentado como si fuese consulta instantánea | **Pendiente / requiere aclaración** | La fuente sigue siendo `git-stats.json`, generado aparte. La suscripción actualiza actividad de auditoría, no todos los KPI. Debe indicarse fecha/fuente y separar actualización del repositorio y datos operativos. |
| **O05** | Advertencias de gráficos y claves de actividad | **Pendiente de limpieza** | Se volvieron a observar advertencias de dimensiones iniciales de Recharts. La composición de claves en el feed permanece; no se certificó la eliminación de duplicados. No impidieron renderizar la pantalla. |

## 6. Otros puntos del recorrido original

| Punto | Estado | Explicación |
|---|---|---|
| Botones demo parecen selección de rol normal | **Pendiente** | Funcionan mediante Server Action, pero siguen sin identificarse claramente como demostración. El nuevo diseño tampoco oculta los botones cuando el entorno desactiva demo; devuelve un error al pulsarlos. |
| Recuperación muestra confirmación sin sesión válida | **Pendiente** | La pantalla actual muestra a la vez “Sesión de recuperación verificada” y “El enlace no tiene una sesión válida o ya expiró”. Se comprobó sin sesión. |
| Errores de callback/login, fuerza de contraseña y términos | **Parcial / pendiente** | Se corrigió “Usuario o correo” a correo y se retiraron controles inertes. El login no comunica los errores del query de callback, el indicador de fuerza sigue basado principalmente en longitud y registro exige aceptar documentos no disponibles. |
| Recuperación del contexto de equipo y organización del espacio tutorial | **Pendiente** | No hay cambios en `equipo/page.tsx` respecto a la auditoría; las acciones y estructura extensa mantienen sus limitaciones. |
| Entrega y recepción docente | **No verificado de extremo a extremo** | La bandeja sigue vacía en la cuenta usada. La pantalla no incorpora consulta/descarga de evidencias. Falta preparar un caso relacionado y probar entrega/acuse en un entorno de demostración. |
| Dataset para expo | **Pendiente** | Se siguen viendo citas históricas, muchos pendientes, duplicados y consultas de prueba. No hay un recorrido actual preparado que muestre claramente al estudiante, tutor y docente trabajando sobre el mismo caso. |
| Tratamiento de errores técnicos / M4 | **Mejorado / parcial** | La API de incidencias y algunas lecturas de justificaciones/notificaciones ocultan errores crudos. El formulario inicial, equipo, docente y algunos estados de citas todavía pueden mostrar detalles técnicos o no explicar el error. |
| Estados globales de carga/error | **Pendiente** | No hay una recuperación de error de producto para las rutas afectadas. La prueba del adjunto grande terminó en la pantalla genérica en inglés de error del servidor. |

## 7. Hallazgos nuevos o precisados durante esta revalidación

### N01. “Abrir trámite” devuelve una lista vacía — alta

`notificationTarget` construye `/justificaciones?q=<uuid>`, pero `q` se aplica a `title.ilike` y `description.ilike`. Se siguió el enlace de un aviso existente y se obtuvo “No hay justificaciones visibles para tu usuario” con cero expedientes. Para citas e incidencias sólo se abre el módulo; tampoco existe selección del registro concreto. La comprobación de código que busca las palabras `metadata.justification_id` y `Abrir tramite` no detecta este fallo.

Fuentes: [notificaciones, destino](<../apps/web/app/(dashboard)/notificaciones/page.tsx#L98>), [justificaciones, filtro](<../apps/web/app/(dashboard)/justificaciones/page.tsx#L313>).

**Evidencia local — Paso 8: resultado incorrecto al abrir el aviso de justificación:** `notification-open-result.png`.

### N02. Adjunto grande rompe la respuesta del alumno — alta

La nueva respuesta usa una Server Action, a diferencia de la carga original desde navegador a Storage. No hay `serverActions.bodySizeLimit` configurado ni validación previa suficiente. Un PDF de prueba de 2 MB ocasionó `Body exceeded 1 MB limit` y página genérica de error, con HTTP 500 visible. No se utilizó un expediente real para la prueba.

Fuentes: `app/(dashboard)/justificaciones/page.tsx:145`, `apps/web/next.config.ts`, límite de la versión instalada de Next en `dist/server/app-render/action-handler.js`.

### N03. El éxito no garantiza que quede registrada la evidencia — alta

Con inserción principal y subida simuladas como correctas, se devolvió error 403 al insertar `justification_files`. El formulario siguió hasta “Justificacion enviada correctamente”. Debe comprobarse el resultado de cada operación relevante y conservar una vía de reintento. Este problema también está presente por código en la nueva respuesta del alumno.

Fuente: `components/justifications/justification-form.tsx:180`, `app/(dashboard)/justificaciones/page.tsx:190`.

### N04. Paginación con totales ambiguos y páginas fuera de rango — media

El encabezado presenta 20 “Total visibles” y 19 “No leídas” en la primera página, mientras la campana indica 27 sin leer y el total real es 199. Son magnitudes distintas sin aclaración suficiente. Además, `?pagina=999` produce un error de consulta, no una redirección/normalización a una página válida; el límite superior se calcula después de consultar. Los filtros de tipo sólo se construyen a partir de los avisos de la página actual.

Fuente: `app/(dashboard)/notificaciones/page.tsx:151` y siguientes.

## 8. Recorridos, estado y capturas de esta revisión

Todas las capturas referenciadas aquí son nuevas y se conservan como evidencia local; no se publican en GitHub porque incluyen información de cuentas y expedientes. La copia local del informe conserva los enlaces a esas capturas. Las capturas hechas durante una transición de tema fueron reemplazadas después de accionar el botón real y esperar estabilidad; no se toman como hallazgos los colores intermedios de la animación.

| Paso | Pantalla / recorrido | Salud actual local | Evidencia |
|---|---|---|---|
| 1 | Acceso cuatro roles | Funciona; demo aún ambigua y endurecimiento parcial. | Acceso: `local-public-login.png` |
| 2 | Registro / recuperación | Disponible; mensaje de recuperación contradictorio pendiente. | Recuperación: `local-public-reset-password.png` |
| 3 | Inicio | Funciona; orientación por rol pendiente. | Dashboard: `local-student-dashboard.png` |
| 4 | Equipo tutorial | Funciona en lectura; UX sin cambios sustanciales. | Equipo: `local-student-equipo.png` |
| 5 | Selección de cita | Mejora comprobada; resto de agenda parcial. | Sábado y aula: `calendar-weekend.png`, validación: `appointment-validation.png` |
| 6 | Justificación y respuesta | Error inicial corregido; respuesta bloqueada por RPC y adjuntos. | Éxito simulado: `isolated-success.png`, formulario de respuesta: `response-form.png` |
| 7 | Recepción docente | Disponible, sin caso completo para verificar. | Docente: `local-teacher-docente.png` |
| 8 | Notificación → expediente | Paginación mejorada; enlace a justificación incorrecto. | Bandeja: `local-student-notificaciones.png`, destino: `notification-open-result.png` |
| 9 | Incidencias | Lectura operativa; API y manejo de errores mejorados parcialmente. | Incidencias: `local-student-incidencias.png` |
| 10 | Lumi | Nueva bandeja; atención al alumno todavía incompleta. | Chat tutor: `local-tutor-chatbot.png` |
| 11 | Admin, logs y observatorio | Portadas claras corregidas; métricas parciales. | Logs local: `local-light-admin-logs.png`, avance local: `local-light-admin-proyecto.png`, admin público: `remote-light-admin.png` |
| 12 | Móvil / teclado | Escape corregido; desbordamiento pendiente. | 390 px: `mobile-student-justificaciones.png`, admin 320 px: `admin-width-320.png` |

## 9. Comprobaciones realizadas y límites

| Comprobación | Resultado |
|---|---|
| ESLint | 0 errores; 1 advertencia de fuente personalizada en layout. |
| TypeScript, sin emisión ni actualización incremental | Correcto. |
| Vitest | 3 archivos; 48 pruebas aprobadas. 41 nuevas son guardias de texto fuente. |
| `pnpm --filter web exec next build` | Correcto. Se omitió el prebuild que modifica `git-stats.json`, porque tiene cambios previos del usuario. |
| Navegación local en build de producción | 4 páginas públicas y 20 combinaciones de ruta/rol, más cambios de tema y vistas móviles. |
| Sitio público | Acceso, recuperación y las tres rutas administrativas; contraste y presencia de controles anteriores comprobados. |
| Error de referencia del formulario | Corregido en prueba de éxito con escrituras interceptadas. |
| Error de metadata | Reproducido: éxito visual pese a fallo simulado del registro del archivo. |
| Citas | Sábado seleccionable, modalidad/lugar heredados y error visible si falta fecha/horario. No se creó reserva real. |
| Nuevo formulario de respuesta | Existe, RPC remoto ausente y adjunto de 2 MB provoca error de límite. |
| Navegación desde notificación | Fallo reproducido por búsqueda de UUID como texto. |
| API de estado IA local sin sesión | HTTP 401; no se consumió inferencia. |
| Migraciones | 54 aplicadas y 3 locales pendientes. |
| Configuración de Vercel | Ambos vínculos locales apuntan a `sync-ut`; proyecto remoto usa Node 22.x. |

La ausencia de RPC se comprobó con una petición GET específica y el historial de migraciones. La exploración OpenAPI general exige una clave privilegiada y no se utilizó como evidencia de ausencia de funciones.

No se aplicó el SQL a una base aislada ni se afirma haber certificado sus transacciones. No se ejecutaron nuevas entregas de correo, invitaciones, cambios de rol, respuestas reales, reservas concurrentes ni pruebas de explotación de permisos. Tampoco se certifica cumplimiento de accesibilidad completo. Estas limitaciones se mantienen explícitas para no confundir compilación o comprobaciones de texto con validación integral.

## 10. Prioridad de atención

1. Corregir el enlace al expediente y el manejo/tamaño de evidencias; terminar el ciclo de respuesta del alumno.
2. Revisar el alcance de las tres migraciones y probar permisos/transiciones en datos aislados; después aplicarlas antes de publicar el frontend dependiente.
3. Rotar las credenciales demo que antes eran públicas y definir el modo de exposición; la cuenta administrativa conserva acceso con las anteriores.
4. Resolver responsive de justificaciones y el mensaje de recuperación; cerrar errores silenciosos y asistencia de citas.
5. Aclarar totales/paginación, quitar controles decorativos restantes y completar la atención de Lumi.
6. Separar avance técnico y salud operativa en el observatorio; preparar un caso de entrega docente con datos de exhibición coherentes.
7. Publicar una versión validada y repetir los recorridos sobre `syncut.click`. Alinear tipos, documentación y M6 en los cambios posteriores, sin confundir esas tareas con los bloqueos funcionales.

**Conclusión de estado:** hay correcciones locales reales, pero B2/B3/D3 siguen pendientes en la base conectada y los cambios del frontend aún no están en el dominio principal. Aplicar las tres migraciones por sí solo no resuelve los fallos restantes que esta revisión reprodujo.
