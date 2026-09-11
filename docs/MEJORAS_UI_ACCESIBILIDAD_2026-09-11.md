# Pasada de UI y accesibilidad

Fecha: 11 de septiembre de 2026. Se conserva la paleta institucional azul y menta del proyecto.

## Cambios de esta pasada

| Paso | Superficie | Mejora aplicada | Validación |
|---|---|---|---|
| 1 | Acceso | El modo demostración se identifica y se distingue de la cuenta personal. Campos obligatorios, botón de contraseña con nombre accesible y errores anunciados. | Navegador: controles, teclado y ancho a 320/390 px. |
| 2 | Registro | Botón de mostrar contraseña accesible, mensajes anunciados y longitud de contraseña sin prometer una fortaleza que no se mide. | Navegador: foco y ancho a 320/390 px. No se registraron cuentas. |
| 3 | Recuperación | Estados separados para comprobar enlace, sesión disponible y enlace inválido. Se elimina la confirmación contradictoria y se permite volver al acceso. | Navegador: enlace inválido, formulario oculto y salida clara; 320/390 px. |
| 4 | Navegación | Diálogo móvil con foco contenido, retorno al botón y cierre al cambiar a escritorio. Enlace para saltar al contenido, destino activo anunciado y menús de perfil/configuración ajustados al ancho móvil. | Componente real en navegador con datos de prueba: Tab, Shift+Tab, Escape, retorno del foco, cambio a escritorio, perfil a 320 px y salto al contenido aprobados. |
| 5 | Justificación nueva | Etiquetas persistentes, instrucciones de fechas y comprobantes, fechas en columna en móvil estrecho y confirmación junto al formulario. El máximo del selector final respeta la ventana ya validada al enviar. | Componente real: etiquetas, validación de campo obligatorio y texto móvil de 16 px comprobados. No se envió una solicitud. |
| 6 | Selector de citas | Pasos tutor → día → horario, botones de mes con nombre, fechas completas para lector de pantalla, día seleccionado anunciado y explicación si no hay horarios. | Componente real: fecha accesible, selección de día, horario y lugar aprobados con disponibilidad de prueba. No se reservó una cita. |
| 7 | Notificaciones | Conteos descritos con su alcance, filtros legibles que conservan el estado, preferencias desplegables con ancla correcta y paginación inactiva fuera de la secuencia de teclado. Botones de guardado muestran espera. | Desplegable real: apertura, cierre y reapertura desde un enlace con el mismo fragmento aprobados. Filtros, paginación y guardado autenticados pendientes. |
| 8 | Lumi | Preguntas frecuentes consultables y buscables, seis resultados iniciales y opción de mostrar más con foco en la primera pregunta nueva. Estado en español, historial accesible por teclado, campos identificados y botones de envío con espera. | FAQ real: búsqueda sin tildes, respuesta desplegable, estado vacío y mostrar más conservando el foco aprobados con preguntas de prueba. No se generaron mensajes de IA. |

Se añadieron estilos de foco, controles táctiles y texto de formulario de 16 px en móvil mediante un módulo CSS. No se reemplaza la paleta global. Se respeta la preferencia de movimiento reducido.

El dashboard de inicio, el observatorio y las gráficas en preparación por el otro agente quedan fuera de este commit. En el archivo compartido de Lumi se versionan únicamente los cambios de interacción de esta pasada; sus nuevas métricas se conservan en el árbol de trabajo del otro agente.

## Comprobaciones y evidencia

- ESLint: cero errores; persiste una advertencia previa de fuente personalizada.
- TypeScript y build de Next correctos durante la revisión.
- Vitest: 63 pruebas aprobadas en la comprobación realizada; incluye pruebas de código fuente existentes, no equivale a certificar interacción.
- Tres grupos de comprobaciones de navegador públicos aprobados: estado inválido de recuperación, controles del acceso y responsive/foco de las cuatro pantallas públicas a 320/390 px.
- Ocho grupos adicionales aprobados en una vista temporal aislada que importa los componentes reales con datos de prueba: menú, perfil, formulario, calendario, preferencias, FAQ, ancho y salto al contenido. Sin errores de JavaScript. Se comprobaron 320, 390, 768 y 1440 px en ambos temas; también se inspeccionaron capturas de móvil y escritorio. La vista temporal no forma parte de las rutas publicadas.
- Capturas de diagnóstico inicial en la carpeta local temporal `syncut-ui-pass`; capturas y resultados de las pruebas en `test-results/ui-accessibility/` (excluida de Git).
- Evidencia de componentes aislados: `component-results.json` y capturas `verified-*.png` en la carpeta temporal local `syncut-ui-pass`.
- No se publican capturas de directorios o expedientes en el repositorio público.

La primera captura autenticada se pudo completar antes de editar. En las comprobaciones posteriores, los accesos de estudiante/tutor y consultas a Supabase superaron los tiempos de espera, incluso ampliando la navegación a 120 segundos; también se reprodujo un timeout fuera del navegador. La inspección de bloqueos no mostró un bloqueo significativo de la base. La verificación aislada confirma las interacciones descritas, pero no sustituye el recorrido autenticado con datos reales, que sigue pendiente. No se afirma conformidad WCAG completa.

## Cómo repetir la comprobación

Con la aplicación iniciada y sus variables habituales de entorno cargadas:

```powershell
# Por defecto apunta al servidor local en el puerto 3101.
node scripts/verify-ui-accessibility.mjs --public-only

# Recorrido completo: necesita el acceso demo de estudiante y sus datos de prueba.
node scripts/verify-ui-accessibility.mjs

# Para usar otro servidor local:
$env:SYNCUT_QA_BASE_URL = 'http://127.0.0.1:3000'
node scripts/verify-ui-accessibility.mjs
```

La prueba completa comprueba foco del diálogo, Escape, retorno al control, menús a 320 px, ancla de preferencias, paginación, etiquetas del formulario, calendario y búsqueda de FAQ. También mide las cuatro rutas académicas a 320/390 px en ambos temas. Usa el inicio de sesión existente; no crea solicitudes, citas, mensajes ni cuentas.

## Pendientes

1. Repetir la comprobación autenticada cuando Supabase vuelva a responder normalmente.
2. Revisar foco y lectura con lector de pantalla real, zoom y medición sistemática de contraste.
3. Completar etiquetas de otros formularios y simplificación de historiales en las páginas compartidas, coordinándolo con el otro agente.
4. Mantener separadas las tareas funcionales y de seguridad del [reporte de revalidación](REVALIDACION_AUDITORIA_SYNCUT_2026-09-11.md). Esta pasada no aplica migraciones ni certifica permisos o transacciones.
5. Revisar, como tarea técnica separada, el tipo preexistente de `params` en `app/api/incidencias/[id]/comentarios/route.ts`: el build alternativo con Webpack rechaza su unión entre objeto y promesa. El build habitual con Turbopack sí pasó; no se modificó esta API en la pasada de UI.
