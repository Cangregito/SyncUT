import { revalidatePath } from "next/cache";
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

export default async function NotificacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; evento?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const canInspectEmailQueue = ["admin", "tutor"].includes(profile.role);

  let query = supabase
    .from("notifications")
    .select("id, event_type, title, body, metadata, is_read, read_at, created_at")
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

  const { data, error } = await query;
  const items = (data ?? []) as NotificationRow[];
  const unread = items.filter((item) => !item.is_read).length;
  const eventTypes = Array.from(new Set(items.map((item) => item.event_type))).sort();
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
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Squad 4</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-headline font-bold text-on-surface">
          Centro de Notificaciones
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Bandeja real de eventos para {profile.email}. No se generan avisos simulados.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <p className="text-xs uppercase text-on-surface-variant">Total visibles</p>
          <p className="mt-2 text-3xl font-bold text-on-surface">{items.length}</p>
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <p className="text-xs uppercase text-on-surface-variant">No leidas</p>
          <p className="mt-2 text-3xl font-bold text-primary">{unread}</p>
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <p className="text-xs uppercase text-on-surface-variant">Usuario</p>
          <p className="mt-2 truncate text-sm font-semibold text-on-surface">{profile.email}</p>
        </div>
      </section>

      <section id="preferencias" className="rounded-lg border border-outline-variant bg-surface-container p-5 scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Bandeja</h2>
          <div className="flex flex-wrap gap-2">
            <a href="/notificaciones" className="rounded border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant">
              Todas
            </a>
            <a href="/notificaciones?estado=no-leidas" className="rounded border border-primary px-3 py-2 text-xs font-semibold text-primary">
              No leidas
            </a>
            <form action={markAllNotificationsRead}>
              <button className="rounded bg-primary-container px-3 py-2 text-xs font-semibold text-on-primary-container">
                Marcar todas leidas
              </button>
            </form>
          </div>
        </div>

        {eventTypes.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {eventTypes.map((eventType) => (
              <a
                key={eventType}
                href={`/notificaciones?evento=${encodeURIComponent(eventType)}`}
                className="rounded border border-outline-variant px-2 py-1 text-[11px] font-semibold text-on-surface-variant hover:border-primary hover:text-primary"
              >
                {eventLabels.get(eventType) ?? fallbackEventLabels[eventType] ?? "Notificación institucional"}
              </a>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded border border-error/40 bg-error-container/20 p-3 text-sm text-on-error-container">
            {error.message}
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {items.length === 0 && !error ? (
            <p className="rounded border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant">
              No hay notificaciones para tu usuario.
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
                <span className={`rounded px-2 py-1 text-[10px] font-semibold uppercase ${item.is_read ? "bg-surface-container-highest text-on-surface-variant" : "bg-primary-container text-on-primary-container"}`}>
                  {item.is_read ? "Leida" : "Nueva"}
                </span>
              </div>
              <p className="mt-3 text-sm text-on-surface-variant">{item.body}</p>
              <form action={toggleNotificationRead} className="mt-4">
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="is_read" value={String(!item.is_read)} />
                <button className="rounded border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant hover:border-primary hover:text-primary">
                  {item.is_read ? "Marcar no leida" : "Marcar leida"}
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Preferencias por evento</h2>
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
                    <p className="mt-1 text-xs text-on-surface-variant">Entrega en plataforma{eventType.channel === "both" ? " y correo" : ""}</p>
                    {eventType.description ? (
                      <p className="mt-2 text-xs text-on-surface-variant">{eventType.description}</p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-on-surface-variant">
                  <label className="inline-flex items-center gap-2">
                    <input name="in_app" type="checkbox" defaultChecked={preference?.in_app ?? defaultInApp} />
                    In-app
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input name="email" type="checkbox" defaultChecked={preference?.email ?? defaultEmail} />
                    Email
                  </label>
                </div>
                <button className="mt-3 rounded border border-primary px-3 py-2 text-xs font-semibold text-primary">
                  Guardar preferencia
                </button>
              </form>
            );
          })}
        </div>
      </section>

      {canInspectEmailQueue ? (
        <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Cola real de correo</h2>
              <p className="mt-1 text-xs text-on-surface-variant">
                Resumen seguro desde RPC. La cola completa permanece protegida por RLS.
              </p>
            </div>
            <span className="rounded border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant">
              {queueSummary.reduce((total, item) => total + Number(item.total), 0)} correos
            </span>
          </div>

          {queueSummaryError ? (
            <p className="mt-4 rounded border border-error/40 bg-error-container/20 p-3 text-sm text-on-error-container">
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
