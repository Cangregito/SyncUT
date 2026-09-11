import { revalidatePath } from "next/cache";
import Link from "next/link";
import { DisclosurePanel } from "@/components/ui/disclosure-panel";
import { SubmitButton } from "@/components/forms/submit-button";
import { redirect } from "next/navigation";
import type { Database, Tables } from "@plataforma/types";

import { requireProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NotificationRow = Tables<"notifications">;
type NotificationEventTypeRow = Tables<"notification_event_types">;
type NotificationPreferenceRow = Tables<"notification_preferences">;
type EmailQueueSummaryRow =
  Database["public"]["Functions"]["get_email_queue_summary"]["Returns"][number];

const teacherEventTypes = ["tutor.teacher_message", "justification.teacher_delivery"];

const fallbackEventLabels: Record<string, string> = {
  "tutor.teacher_message": "Mensaje de tutoría",
  "justification.teacher_delivery": "Justificante enviado por el tutor",
  "justification.teacher_received": "Justificante recibido por el docente",
  "incident.assigned": "Incidencia asignada",
  "appointment.created": "Nueva cita de tutoría",
};

async function toggleNotificationRead(formData: FormData) {
  "use server";

  await requireProfile();
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "");
  const nextValue = String(formData.get("is_read") ?? "") === "true";

  if (!id) return;

  await supabase
    .from("notifications")
    .update({
      is_read: nextValue,
      read_at: nextValue ? new Date().toISOString() : null,
    })
    .eq("id", id);

  revalidatePath("/notificaciones");
  revalidatePath("/dashboard");
}

async function markAllNotificationsRead() {
  "use server";

  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("user_id", profile.id)
    .eq("is_read", false);

  revalidatePath("/notificaciones");
  revalidatePath("/dashboard");
}

async function updatePreference(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const eventType = String(formData.get("event_type") ?? "");
  const inApp = String(formData.get("in_app") ?? "") === "on";
  const email = String(formData.get("email") ?? "") === "on";

  if (!eventType) {
    return;
  }

  await supabase.from("notification_preferences").upsert({
    user_id: profile.id,
    event_type: eventType,
    in_app: inApp,
    email,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "user_id,event_type",
  });

  revalidatePath("/notificaciones");
}

const PAGE_SIZE = 20;

/**
 * A4 - `metadata` ya viajaba en la consulta pero se descartaba, asi que el
 * usuario tenia que buscar a mano el expediente cuyo identificador ya estaba
 * cargado. Aqui se convierte en el destino del aviso.
 */
function notificationTarget(row: { event_type: string; metadata: unknown }): string | null {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const asId = (value: unknown) => (typeof value === "string" && value ? value : null);

  const justificationId = asId(metadata.justification_id);
  if (justificationId) return `/justificaciones?q=${encodeURIComponent(justificationId)}`;

  const appointmentId = asId(metadata.appointment_id);
  if (appointmentId) return "/citas";

  const incidentId = asId(metadata.incident_id);
  if (incidentId) return "/incidencias";

  const deliveryId = asId(metadata.delivery_id);
  if (deliveryId) return "/docente";

  if (row.event_type.startsWith("chatbot.")) return "/chatbot";
  if (row.event_type.startsWith("team.")) return "/equipo";

  return null;
}

export default async function NotificacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; evento?: string; pagina?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const canInspectEmailQueue = ["admin", "tutor"].includes(profile.role);

  let query = supabase
    .from("notifications")
    .select("id, event_type, title, body, metadata, is_read, read_at, created_at", { count: "exact" })
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  if (profile.role === "teacher") {
    query = query.in("event_type", teacherEventTypes);
  }

  if (params.estado === "no-leidas") {
    query = query.eq("is_read", false);
  }

  if (params.evento) {
    query = query.eq("event_type", params.evento);
  }

  // A3 - sin limite, una bandeja con 199 avisos generaba un documento de unos
  // 37 000 px de alto. La consulta se acota y se pagina.
  const requestedPage = Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1);
  const { data, error, count } = await query.range(
    (requestedPage - 1) * PAGE_SIZE,
    requestedPage * PAGE_SIZE - 1,
  );
  const totalItems = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  // Una pagina fuera de rango devolvia una lista vacia con un contador
  // clavado en la ultima pagina: se redirige a la ultima real.
  if (requestedPage > totalPages) {
    const search = new URLSearchParams();
    if (params.estado) search.set("estado", params.estado);
    if (params.evento) search.set("evento", params.evento);
    if (totalPages > 1) search.set("pagina", String(totalPages));
    const query = search.toString();
    redirect(query ? `/notificaciones?${query}` : "/notificaciones");
  }

  const currentPage = requestedPage;
  const items = (data ?? []) as NotificationRow[];

  function pageHref(page: number) {
    const search = new URLSearchParams();
    if (params.estado) search.set("estado", params.estado);
    if (params.evento) search.set("evento", params.evento);
    if (page > 1) search.set("pagina", String(page));
    const query = search.toString();
    return query ? `/notificaciones?${query}` : "/notificaciones";
  }
  const unread = items.filter((item) => !item.is_read).length;
  const [{ data: allEventTypesData }, { data: preferencesData }] = await Promise.all([
    supabase
      .from("notification_event_types")
      .select("id, slug, label, description, channel, created_at")
      .order("slug", { ascending: true }),
    supabase
      .from("notification_preferences")
      .select("id, user_id, event_type, in_app, email, updated_at")
      .eq("user_id", profile.id),
  ]);
  const allEventTypes = ((allEventTypesData ?? []) as NotificationEventTypeRow[]).filter((eventType) => profile.role !== "teacher" || teacherEventTypes.includes(eventType.slug));
  const eventLabels = new Map(allEventTypes.map((eventType) => [eventType.slug, eventType.label]));
  const preferences = (preferencesData ?? []) as NotificationPreferenceRow[];
  const preferencesByEvent = new Map(preferences.map((preference) => [preference.event_type, preference]));
  let queueSummary: EmailQueueSummaryRow[] = [];
  let queueSummaryError: string | null = null;

  if (canInspectEmailQueue) {
    const { data: queueData, error: queueError } = await supabase.rpc("get_email_queue_summary");
    queueSummary = (queueData ?? []) as EmailQueueSummaryRow[];
    queueSummaryError = queueError?.message ?? null;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Avisos del portal</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-headline font-bold text-on-surface">
          Centro de Notificaciones
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Consulta las novedades de tus trámites y elige qué avisos quieres recibir.
        </p>
        <a href="#preferencias" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">Configurar mis avisos</a>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <p className="text-xs uppercase text-on-surface-variant">Avisos con estos filtros</p>
          <p className="mt-2 text-3xl font-bold text-on-surface">{totalItems}</p>
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <p className="text-xs uppercase text-on-surface-variant">Sin leer en esta página</p>
          <p className="mt-2 text-3xl font-bold text-primary">{unread}</p>
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <p className="text-xs uppercase text-on-surface-variant">Página actual</p>
          <p className="mt-2 truncate text-sm font-semibold text-on-surface">{currentPage} de {totalPages}</p>
        </div>
      </section>

      <section id="bandeja" className="rounded-lg border border-outline-variant bg-surface-container p-5 scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Bandeja</h2>
          <div className="flex flex-wrap gap-2">
            <a href={params.evento ? `/notificaciones?evento=${encodeURIComponent(params.evento)}` : "/notificaciones"} aria-current={params.estado !== "no-leidas" ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg border px-3 py-2 text-sm font-semibold ${params.estado !== "no-leidas" ? "border-primary bg-primary-container text-on-primary-container" : "border-outline-variant text-on-surface-variant"}`}>
              Todas
            </a>
            <a href={`/notificaciones?estado=no-leidas${params.evento ? `&evento=${encodeURIComponent(params.evento)}` : ""}`} aria-current={params.estado === "no-leidas" ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg border px-3 py-2 text-sm font-semibold ${params.estado === "no-leidas" ? "border-primary bg-primary-container text-on-primary-container" : "border-outline-variant text-on-surface-variant"}`}>
              Sin leer
            </a>
            <form action={markAllNotificationsRead}>
              <SubmitButton pendingLabel="Marcando…" className="rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant">
                Marcar todas como leídas
              </SubmitButton>
            </form>
          </div>
        </div>

        <form className="mt-4 flex flex-wrap items-end gap-3">
          {params.estado && <input type="hidden" name="estado" value={params.estado} />}
          <label className="min-w-0 flex-1 text-sm font-medium text-on-surface">
            Tipo de aviso
            <select name="evento" defaultValue={params.evento ?? ""} className="mt-2 min-h-11 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface">
              <option value="">Todos los tipos</option>
              {allEventTypes.map((eventType) => <option key={eventType.slug} value={eventType.slug}>{eventType.label}</option>)}
            </select>
          </label>
          <button className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary">Filtrar avisos</button>
          {params.evento && <Link href={params.estado === "no-leidas" ? "/notificaciones?estado=no-leidas" : "/notificaciones"} className="inline-flex min-h-11 items-center px-2 text-sm text-primary underline underline-offset-4">Quitar filtro</Link>}
        </form>

        {error ? (
          <p role="alert" className="mt-4 rounded border border-error/40 bg-error-container/20 p-3 text-sm text-on-error-container">
            No se pudieron consultar tus notificaciones. Actualiza la pagina en unos segundos.
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {items.length === 0 && !error ? (
            <p className="rounded border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant">
              {params.estado === "no-leidas" ? "No tienes avisos sin leer con estos filtros." : "No hay avisos con estos filtros. Puedes seleccionar otro tipo o consultar todos."}
            </p>
          ) : null}

          {items.map((item) => (
            <article key={item.id} className="rounded border border-outline-variant bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-on-surface">{item.title}</h3>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {eventLabels.get(item.event_type) ?? fallbackEventLabels[item.event_type] ?? "Notificación institucional"} · {new Date(item.created_at).toLocaleString("es-MX")}
                  </p>
                </div>
                <span className={`rounded px-2 py-1 text-xs font-semibold uppercase ${item.is_read ? "bg-surface-container-highest text-on-surface-variant" : "bg-primary-container text-on-primary-container"}`}>
                  {item.is_read ? "Leída" : "Nueva"}
                </span>
              </div>
              <p className="mt-3 text-sm text-on-surface-variant">{item.body}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <form action={toggleNotificationRead}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="is_read" value={String(!item.is_read)} />
                  <button className="rounded border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant hover:border-primary hover:text-primary">
                    {item.is_read ? "Marcar como no leída" : "Marcar como leída"}
                  </button>
                </form>
                {notificationTarget(item) ? (
                  <Link
                    href={notificationTarget(item)!}
                    className="rounded bg-primary-container px-3 py-2 text-xs font-semibold text-on-primary-container hover:bg-primary"
                  >
                    Abrir tramite
                  </Link>
                ) : null}
              </div>
            </article>
          ))}

          {totalPages > 1 ? (
            <nav aria-label="Paginación de notificaciones" className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Link
                href={pageHref(Math.max(1, currentPage - 1))}
                aria-disabled={currentPage === 1}
                tabIndex={currentPage === 1 ? -1 : undefined}
                className={`rounded border px-3 py-2 text-xs font-semibold ${currentPage === 1 ? "pointer-events-none border-outline-variant/40 text-on-surface-variant/40" : "border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"}`}
              >
                Anteriores
              </Link>
              <span className="text-xs text-on-surface-variant">
                Página {currentPage} de {totalPages} · {totalItems} avisos
              </span>
              <Link
                href={pageHref(Math.min(totalPages, currentPage + 1))}
                aria-disabled={currentPage === totalPages}
                tabIndex={currentPage === totalPages ? -1 : undefined}
                className={`rounded border px-3 py-2 text-xs font-semibold ${currentPage === totalPages ? "pointer-events-none border-outline-variant/40 text-on-surface-variant/40" : "border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"}`}
              >
                Siguientes
              </Link>
            </nav>
          ) : null}
        </div>
      </section>

      <DisclosurePanel id="preferencias" title="Preferencias de notificaciones" description="Elige qué avisos recibir en el portal y por correo. Abre esta sección para configurarlos.">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Personalizar avisos</h2>
          <span className="text-xs text-on-surface-variant">{allEventTypes.length} tipos disponibles</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {allEventTypes.map((eventType) => {
            const preference = preferencesByEvent.get(eventType.slug);
            const defaultInApp = eventType.channel === "in_app" || eventType.channel === "both";
            const defaultEmail = eventType.channel === "email" || eventType.channel === "both";
            return (
              <form key={eventType.slug} action={updatePreference} className="rounded border border-outline-variant bg-surface p-4">
                <input type="hidden" name="event_type" value={eventType.slug} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{eventType.label}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">Canal disponible: {eventType.channel === "both" ? "portal y correo" : eventType.channel === "email" ? "correo electrónico" : "portal"}</p>
                    {eventType.description ? (
                      <p className="mt-2 text-xs text-on-surface-variant">{eventType.description}</p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-on-surface-variant">
                  <label className="inline-flex items-center gap-2">
                    <input name="in_app" type="checkbox" defaultChecked={preference?.in_app ?? defaultInApp} />
                    En el portal
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input name="email" type="checkbox" defaultChecked={preference?.email ?? defaultEmail} />
                    Correo electrónico
                  </label>
                </div>
                <SubmitButton pendingLabel="Guardando…" className="mt-3 rounded border border-primary px-3 py-2 text-sm font-semibold text-primary">
                  Guardar preferencia
                </SubmitButton>
              </form>
            );
          })}
        </div>
      </DisclosurePanel>

      {canInspectEmailQueue ? (
        <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Cola real de correo</h2>
              <p className="mt-1 text-xs text-on-surface-variant">
                Resumen de los correos en cola. El detalle solo es visible para su destinatario.
              </p>
            </div>
            <span className="rounded border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant">
              {queueSummary.reduce((total, item) => total + Number(item.total), 0)} correos
            </span>
          </div>

          {queueSummaryError ? (
            <p role="alert" className="mt-4 rounded border border-error/40 bg-error-container/20 p-3 text-sm text-on-error-container">
              {queueSummaryError}
            </p>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {queueSummary.length === 0 && !queueSummaryError ? (
              <p className="rounded border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant md:col-span-2 xl:col-span-5">
                No hay correos registrados en la cola.
              </p>
            ) : null}

            {queueSummary.map((item) => (
              <article key={item.status} className="rounded border border-outline-variant bg-surface p-4">
                <p className="text-xs font-semibold uppercase text-on-surface-variant">{item.status}</p>
                <p className="mt-2 text-2xl font-bold text-on-surface">{Number(item.total).toLocaleString("es-MX")}</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {item.oldest_scheduled_at
                    ? `Mas antiguo: ${new Date(item.oldest_scheduled_at).toLocaleString("es-MX")}`
                    : "Sin programacion pendiente"}
                </p>
                {item.last_error ? (
                  <p className="mt-2 break-words text-xs text-error">{item.last_error}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

    </div>
  );
}
