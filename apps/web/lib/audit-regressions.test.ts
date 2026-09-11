import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cada prueba de este archivo corresponde a un hallazgo de la auditoria del
 * 11 de septiembre de 2026 y falla si el problema vuelve al codigo.
 *
 * Son comprobaciones sobre el codigo fuente, no pruebas de comportamiento: el
 * proyecto no tiene entorno DOM configurado. Detectan la reaparicion del patron
 * exacto que causo cada fallo, que es justo lo que se cuela en una revision.
 */

// AUDIT_ROOT permite ejecutar estas guardias contra otra copia del repositorio
// (por ejemplo el arbol anterior a los arreglos) para comprobar que detectan.
const webRoot = process.env.AUDIT_ROOT ?? fileURLToPath(new URL("..", import.meta.url));

function source(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("B1 - credenciales de demostracion fuera del navegador", () => {
  it("no deja contrasenas en modulos que llegan al cliente", () => {
    for (const file of [
      "lib/auth/roles.ts",
      "app/(auth)/login/page.tsx",
      "components/layout/dashboard-shell.tsx",
    ]) {
      expect(source(file), `${file} no debe contener credenciales`).not.toMatch(
        /password\s*:\s*["'`]/i,
      );
    }
  });

  it("mantiene las credenciales en un modulo server-only", () => {
    const demo = source("lib/auth/demo-accounts.ts");
    expect(demo).toContain('import "server-only"');
  });

  it("no ofrece gobernanza a un clic desde la pantalla publica", () => {
    // Mover la contrasena al servidor no basta: un boton publico que concede
    // rol admin a cualquier visitante es el mismo riesgo.
    expect(source("lib/auth/roles.ts")).toMatch(
      /DEMO_QUICK_ACCESS_ROLES[^=]*=\s*\[[^\]]*\]/,
    );
    const quickAccess = source("lib/auth/roles.ts").match(
      /DEMO_QUICK_ACCESS_ROLES[^=]*=\s*(\[[^\]]*\])/,
    )?.[1];
    expect(quickAccess).not.toContain("admin");
    expect(source("app/(auth)/login/actions.ts")).toContain("DEMO_QUICK_ACCESS_ROLES.includes(role)");
  });

  it("hace el acceso de demostracion por Server Action", () => {
    const actions = source("app/(auth)/login/actions.ts");
    expect(actions.startsWith('"use server"')).toBe(true);
    expect(source("app/(auth)/login/page.tsx")).toContain("signInWithDemoRole");
  });
});

describe("B4 - el endpoint de estado de IA no es publico", () => {
  it("exige sesion y cachea la sonda del proveedor", () => {
    const route = source("app/api/chatbot/status/route.ts");
    expect(route).toContain("createSupabaseRequestClient");
    expect(route).toContain("401");
    expect(route).toMatch(/PROBE_TTL_MS|expiresAt/);
  });
});

describe("D1 - el formulario de justificaciones confirma el envio", () => {
  const form = source("components/justifications/justification-form.tsx");

  it("captura la referencia al formulario antes del primer await", () => {
    // `event.currentTarget` es null despues del despacho del evento: usarlo
    // tras un await lanzaba TypeError y mataba el mensaje de exito.
    expect(form).toContain("const form = event.currentTarget;");

    const handler = form.slice(form.indexOf("async function handleSubmit"));
    const afterFirstAwait = handler.slice(handler.indexOf("await "));
    expect(afterFirstAwait).not.toContain("event.currentTarget");
  });

  it("captura los fallos inesperados en lugar de dejar la promesa rota", () => {
    const handler = form.slice(form.indexOf("async function handleSubmit"));
    expect(handler).toMatch(/}\s*catch\s*(\(|\{)/);
  });
});

describe("D4 - la variante dark sigue al tema de la aplicacion", () => {
  it("declara @custom-variant dark anclada a data-theme", () => {
    // Sin esta declaracion, `dark:` apunta a prefers-color-scheme y los
    // componentes de components/ui/ ignoran el boton de tema.
    const css = source("app/globals.css");
    expect(css).toMatch(/@custom-variant\s+dark\s*\(/);
    expect(css).toMatch(/@custom-variant\s+dark[^;]*data-theme="dark"/);
  });
});

describe("D5 - las portadas administrativas adaptan su superficie", () => {
  it("no deja el degradado oscuro escrito en el JSX", () => {
    for (const file of [
      "app/(dashboard)/admin/page.tsx",
      "app/(dashboard)/admin/logs/page.tsx",
      "app/(dashboard)/admin/proyecto/page.tsx",
    ]) {
      expect(source(file), `${file} debe usar .admin-hero`).not.toContain("linear-gradient(135deg,#15131b");
      expect(source(file)).toContain("admin-hero");
    }
  });

  it("define la portada para ambos temas", () => {
    const css = source("app/globals.css");
    expect(css).toMatch(/^\.admin-hero\s*\{/m);
    expect(css).toMatch(/\[data-theme="light"\]\s*\.admin-hero\s*\{/);
  });
});

describe("D6 - la API de incidencias puede insertar y no filtra Postgres", () => {
  const route = source("app/api/incidencias/route.ts");

  it("resuelve team_id en el servidor, que es lo que exige la politica RLS", () => {
    expect(route).toContain("tutor_team_members");
    expect(route).toContain("team_id: membership.team_id");
  });

  it("no devuelve message, code ni hint del motor de base de datos", () => {
    for (const file of [
      "app/api/incidencias/route.ts",
      "app/api/incidencias/[id]/route.ts",
      "app/api/incidencias/[id]/comentarios/route.ts",
      "app/api/incidencias/metrics/route.ts",
    ]) {
      const contents = source(file);
      expect(contents, `${file} filtra detalle del motor`).not.toMatch(
        /(details|error):\s*\w*[Ee]rror\??\.(message|hint|code)/,
      );
    }
  });
});

describe("D2 - solicitar una cita explica siempre el resultado", () => {
  const page = source("app/(dashboard)/citas/page.tsx");
  const action = page.slice(
    page.indexOf("async function createAppointment"),
    page.indexOf("async function updateAppointmentStatus"),
  );

  it("no tiene salidas silenciosas", () => {
    expect(action).not.toMatch(/^\s*return;\s*$/m);
    expect(action.match(/citasError\(/g)?.length ?? 0).toBeGreaterThan(5);
  });

  it("captura el error del insert en lugar de ignorarlo", () => {
    expect(action).toContain("error: appointmentError");
    expect(action).toContain("if (appointmentError || !appointment)");
  });

  it("hereda modalidad y lugar del bloque publicado", () => {
    // Pedir la modalidad aparte permitia contradecir el horario elegido.
    expect(action).toContain("isAppointmentModality(slot.modality)");
    expect(action).toContain("slot.location");
    expect(page).not.toContain('<ModalityDetailsFields mode="appointment" />');
  });

  it("muestra el resultado en pantalla", () => {
    expect(page).toContain("params.error");
    expect(page).toContain("params.exito");
  });
});

describe("A5 - los dias habiles salen de la disponibilidad real", () => {
  it("no bloquea sabado y domingo en duro", () => {
    const picker = source("components/appointments/appointment-slot-picker.tsx");
    expect(picker).not.toContain("weekday === 0 || weekday === 6");

    const page = source("app/(dashboard)/citas/page.tsx");
    expect(page).not.toMatch(/requestedDay === 0 \|\| requestedDay === 6/);
  });
});

describe("D3 - el alumno puede responder a una solicitud de informacion", () => {
  const page = source("app/(dashboard)/justificaciones/page.tsx");

  it("expone una accion de respuesta sobre el mismo folio", () => {
    expect(page).toContain("async function respondToInfoRequest");
    expect(page).toContain("respond_to_justification_info_request");
  });

  it("muestra el formulario solo al dueno de una solicitud en ese estado", () => {
    expect(page).toContain('item.student_id === profile.id && item.status === "requires_more_info"');
  });

  it("permite adjuntar evidencia adicional", () => {
    const action = page.slice(
      page.indexOf("async function respondToInfoRequest"),
      page.indexOf("async function addReviewNote"),
    );
    expect(action).toContain("evidencias_justificaciones");
    expect(action).toContain("justification_files");
  });
});

describe("M4 - los errores del motor no llegan al usuario", () => {
  it("no imprime el mensaje crudo de una consulta fallida", () => {
    const page = source("app/(dashboard)/justificaciones/page.tsx");
    expect(page).not.toContain("justificationsError.message");
  });

  it("solo propaga mensajes que la propia funcion SQL redacto", () => {
    const page = source("app/(dashboard)/justificaciones/page.tsx");
    expect(page).toContain('["42501", "22023", "P0002"].includes(error.code ?? "")');
  });
});

describe("A1/A2 - la barra superior no ofrece destinos muertos", () => {
  const shell = source("components/layout/dashboard-shell.tsx");

  it("deriva los destinos del rol en lugar de fijarlos", () => {
    expect(shell).toContain("getModulesForRole(role)");
    expect(shell).toContain("const notificationsLink");
    expect(shell).toContain("const homeLink");
    // Antes habia enlaces fijos a /dashboard y /chatbot que el proxy rebotaba.
    expect(shell).not.toContain('href="/dashboard"');
    expect(shell).not.toContain('href="/chatbot"');
  });

  it("retira el buscador sin accion conectada", () => {
    expect(shell).not.toContain('placeholder="Buscar en el portal..."');
  });

  it("pinta el indicador solo cuando hay avisos sin leer", () => {
    expect(shell).toContain("unreadCount > 0");
    expect(source("app/(dashboard)/layout.tsx")).toContain('count: "exact"');
  });

  it("cierra los menus con Escape y bloquea el scroll de fondo", () => {
    expect(shell).toContain('event.key !== "Escape"');
    expect(shell).toContain('document.body.style.overflow = "hidden"');
  });
});

describe("A3 - los listados estan acotados", () => {
  it("pagina las notificaciones", () => {
    const page = source("app/(dashboard)/notificaciones/page.tsx");
    expect(page).toContain(".range(");
    expect(page).toContain("PAGE_SIZE");
  });

  it("limita justificaciones e incidencias", () => {
    expect(source("app/(dashboard)/justificaciones/page.tsx")).toContain(".limit(50)");
    expect(source("app/(dashboard)/incidencias/page.tsx")).toContain(".limit(50)");
  });
});

describe("A4 - cada aviso abre su tramite", () => {
  it("usa metadata para construir el destino", () => {
    const page = source("app/(dashboard)/notificaciones/page.tsx");
    expect(page).toContain("function notificationTarget");
    expect(page).toContain("metadata.justification_id");
    expect(page).toContain("Abrir tramite");
  });
});

describe("A6 - Lumi escala igual por las dos ramas y alguien lo ve", () => {
  const page = source("app/(dashboard)/chatbot/page.tsx");

  it("la rama de IA tambien crea la escalacion", () => {
    const aiBranch = page.slice(page.indexOf("if (aiAnswer) {"), page.indexOf("} else if (match) {"));
    expect(aiBranch).toContain("match?.requires_handoff");
    expect(aiBranch).toContain("chatbot_handoffs");
  });

  it("existe una bandeja para quien puede atenderlas", () => {
    expect(page).toContain("canAttendHandoffs");
    expect(page).toContain('.eq("status", "pending")');
    expect(page).toContain("async function resolveHandoff");
  });
});

describe("A7 - la proteccion de rutas usa la tabla de permisos", () => {
  const proxy = source("proxy.ts");

  it("no depende de un caso especial para admin", () => {
    expect(proxy).toContain("getModulesForRole(role)");
    expect(proxy).not.toContain('profile?.role === "admin"');
  });

  it("cubre tambien la bandeja docente", () => {
    expect(proxy).toContain('"/docente"');
  });
});

describe("A8 - sin controles decorativos", () => {
  it("el boton de roadmap lleva a su seccion", () => {
    expect(source("components/modules/executive-dashboard/sections/executive-header.tsx")).toContain('href="#roadmap"');
    expect(source("components/modules/executive-dashboard/executive-dashboard-page.tsx")).toContain('id="roadmap"');
  });

  it("no quedan enlaces a # ni casillas inertes", () => {
    for (const file of ["app/(auth)/login/page.tsx", "app/(auth)/signup/page.tsx"]) {
      expect(source(file), `${file} tiene enlaces a #`).not.toContain('href="#"');
    }
    expect(source("app/(auth)/login/page.tsx")).not.toContain('id="remember-me"');
  });
});

describe("M1/M2 - el observatorio solo afirma lo que mide", () => {
  const data = source("components/modules/executive-dashboard/data.ts");

  it("no conserva datos fabricados que nadie renderiza", () => {
    for (const dead of ["globalActivity", "chartData", "export const owners", "export const modules"]) {
      expect(data, `${dead} deberia estar eliminado`).not.toContain(dead);
    }
  });

  it("no declara un uptime que no se mide", () => {
    expect(data).not.toContain("99.98%");
    expect(data).not.toContain("Uptime sistema");
  });

  it("el estado del sistema sale de la lectura real", () => {
    expect(data).not.toContain("online: true");
    expect(source("components/modules/executive-dashboard/executive-dashboard-page.tsx")).toContain(
      "online: liveStats.hasLiveSource",
    );
  });
});

describe("M3 - la interfaz habla de tareas, no de implementacion", () => {
  it("no muestra el reparto por squad al alumno", () => {
    expect(source("components/layout/dashboard-shell.tsx")).toContain('role === "admin"');
    for (const file of [
      "app/(dashboard)/citas/page.tsx",
      "app/(dashboard)/justificaciones/page.tsx",
      "app/(dashboard)/incidencias/page.tsx",
      "app/(dashboard)/notificaciones/page.tsx",
    ]) {
      expect(source(file), `${file} muestra la etiqueta de squad`).not.toMatch(/>Squad \d</);
    }
  });

  it("no nombra RLS ni Supabase en textos de usuario", () => {
    for (const file of [
      "app/(dashboard)/citas/page.tsx",
      "app/(dashboard)/dashboard/page.tsx",
      "app/(dashboard)/incidencias/page.tsx",
    ]) {
      expect(source(file), `${file} menciona RLS al usuario`).not.toContain("por RLS");
    }
  });

  it("da al portal un titulo propio", () => {
    const layout = source("app/layout.tsx");
    expect(layout).not.toContain('title: "Centro Ejecutivo de Avance"');
    expect(layout).toContain("SyncUT");
  });
});

describe("Revalidacion - defectos introducidos por los propios arreglos", () => {
  it("'Abrir tramite' encuentra el expediente por id, no como texto", () => {
    const page = source("app/(dashboard)/justificaciones/page.tsx");
    expect(page).toContain('query = query.eq("id", term)');
    // El texto libre no puede romper la sintaxis de filtros de PostgREST.
    expect(page).toContain("replace(/[,()]/g");
  });

  it("los adjuntos por Server Action caben en el limite configurado", () => {
    const config = source("next.config.ts");
    expect(config).toMatch(/bodySizeLimit:\s*"\d+mb"/);
  });

  it("un fallo al registrar la evidencia no deja un archivo huerfano", () => {
    const page = source("app/(dashboard)/justificaciones/page.tsx");
    const action = page.slice(
      page.indexOf("async function respondToInfoRequest"),
      page.indexOf("async function addReviewNote"),
    );
    expect(action).toContain("error: fileRowError");
    expect(action).toContain(".remove([filePath])");
  });

  it("una pagina de notificaciones fuera de rango redirige a la ultima", () => {
    const page = source("app/(dashboard)/notificaciones/page.tsx");
    expect(page).toContain("if (requestedPage > totalPages)");
    expect(page).not.toContain("Math.min(requestedPage, totalPages)");
  });
});

describe("U02 - sin desbordamiento horizontal en movil", () => {
  it("la columna principal puede encoger por debajo de su contenido", () => {
    // Sin min-w-0 el flex item crecia hasta el contenido mas ancho y toda la
    // pagina pasaba de 390 a 468 px.
    expect(source("components/layout/dashboard-shell.tsx")).toMatch(
      /className="flex-1 min-w-0 md:ml-64 flex flex-col min-h-screen"/,
    );
  });

  it("el nombre de archivo de una evidencia no impone su ancho", () => {
    // Un nombre sin espacios no se parte: su tope debe ser relativo al viewport.
    expect(source("app/(dashboard)/justificaciones/page.tsx")).toContain("max-w-[40vw]");
  });

  it("las rejillas del observatorio definen columna base", () => {
    // `grid` sin `grid-cols` crea una pista auto que crece con los carruseles
    // en vez de dejarles hacer scroll.
    expect(source("components/modules/executive-dashboard/executive-dashboard-page.tsx")).not.toMatch(
      /className="grid gap-4 (?:md|lg|xl):grid-cols/,
    );
  });

  it("los formularios de administracion apilan en pantallas estrechas", () => {
    expect(source("app/(dashboard)/admin/page.tsx")).not.toContain('className="grid grid-cols-[1fr_1.4fr_auto] gap-2"');
    expect(source("app/(dashboard)/admin/page.tsx")).toContain('<form className="flex flex-wrap gap-2">');
  });
});

describe("Recuperacion - el motivo de volver al login se muestra", () => {
  it("la pantalla de acceso lee ?error=", () => {
    const login = source("app/(auth)/login/page.tsx");
    expect(login).toContain('.get("error")');
    expect(login).toContain("account_inactive");
  });

  it("recuperacion no muestra mensajes crudos del proveedor", () => {
    expect(source("app/(auth)/forgot-password/page.tsx")).not.toContain("setErrorMsg(error.message)");
    expect(source("app/(auth)/reset-password/page.tsx")).not.toContain("setErrorMsg(error.message)");
  });
});

describe("Marca - paleta azul/menta sin restos de morado", () => {
  it("los tokens del tema parten de los colores institucionales", () => {
    const css = source("app/globals.css");
    expect(css).toContain("--primary-container: #274978");
    expect(css).toContain("--primary: #274978");
    expect(css).toContain("--tertiary: #4cd49e");
  });

  it("las vistas administrativas usan tokens semanticos, no violet-*", () => {
    for (const file of [
      "app/globals.css",
      "app/(dashboard)/admin/page.tsx",
      "app/(dashboard)/admin/logs/page.tsx",
      "app/(dashboard)/admin/logs/logs-filter-bar.tsx",
      "app/(dashboard)/admin/proyecto/page.tsx",
    ]) {
      expect(source(file), `${file} no debe usar la paleta violet`).not.toMatch(/\b(violet|purple|indigo|fuchsia)-\d{3}\b/);
    }
  });
});

describe("Graficas - kit de components/charts", () => {
  it("todo componente que importa recharts declara use client", () => {
    for (const file of ["components/charts/signal-trend.tsx", "components/charts/donut-chart.tsx"]) {
      const code = source(file);
      expect(code).toContain('from "recharts"');
      expect(code.trimStart().startsWith('"use client"'), `${file} debe empezar con "use client"`).toBe(true);
    }
  });

  it("las primitivas SVG no cargan recharts ni hooks (se renderizan en servidor)", () => {
    for (const file of [
      "components/charts/health-gauge.tsx",
      "components/charts/progress-ring.tsx",
      "components/charts/stacked-bar.tsx",
      "components/charts/sparkline.tsx",
    ]) {
      const code = source(file);
      expect(code, `${file} no debe importar recharts`).not.toContain("recharts");
      expect(code, `${file} no debe usar hooks`).not.toMatch(/\buse(State|Effect|Ref|Memo)\(/);
    }
  });

  it("las rejillas de graficas definen columna base para movil", () => {
    for (const file of ["app/(dashboard)/equipo/page.tsx", "app/(dashboard)/dashboard/page.tsx", "app/(dashboard)/incidencias/page.tsx"]) {
      expect(source(file), `${file}`).not.toMatch(/className="grid gap-4 (?:md|lg|xl):grid-cols/);
    }
    expect(source("app/globals.css")).toMatch(/--chart-amber:/);
    expect(source("app/globals.css")).toMatch(/@keyframes chart-draw/);
  });
});
