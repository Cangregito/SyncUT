import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Tables } from "@plataforma/types";

import { SubmitButton } from "@/components/forms/submit-button";
import { FilePreviewModal } from "@/components/files/file-preview-modal";
import { JustificationForm } from "@/components/justifications/justification-form";
import { DonutChart } from "@/components/charts/donut-chart";
import { SignalTrend } from "@/components/charts/signal-trend";
import { StackedBar } from "@/components/charts/stacked-bar";
import { requireProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type JustificationStatus = NonNullable<Tables<"justifications">["status"]>;
type JustificationCategory = Tables<"justifications">["category"];

type ProfileSummary = {
  full_name: string | null;
  email: string;
};

type JustificationRow = Tables<"justifications"> & {
  folio?: string | null;
  due_date?: string | null;
  student: ProfileSummary | null;
  reviewer: ProfileSummary | null;
};

type AuditRow = Tables<"justification_audit_events"> & {
  actor: ProfileSummary | null;
};

type FileRow = Tables<"justification_files">;

const statusLabels: Record<JustificationStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  requires_more_info: "Requiere informacion",
};

const categoryLabels: Record<JustificationCategory, string> = {
  medical: "Medica",
  official: "Oficial",
  personal: "Personal",
};

function isCategory(value: string): value is JustificationCategory {
  return value === "medical" || value === "official" || value === "personal";
}

function isStatus(value: string): value is JustificationStatus {
  return ["pending", "approved", "rejected", "requires_more_info"].includes(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function statusClass(status: JustificationStatus) {
  if (status === "approved") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "rejected") return "bg-rose-100 text-rose-800 border-rose-200";
  if (status === "requires_more_info") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-sky-100 text-sky-800 border-sky-200";
}

async function updateJustificationStatus(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "");
  const nextStatusValue = String(formData.get("status") ?? "");
  const nextStatus = isStatus(nextStatusValue) ? nextStatusValue : null;
  const reviewNotes = String(formData.get("review_notes") ?? "").trim();

  if (!id || !nextStatus) {
    return;
  }

  const canResolve = hasPermission(profile.role, "justifications:resolve");
  const canRequestInfo =
    hasPermission(profile.role, "justifications:tutor_followup") &&
    nextStatus === "requires_more_info";

  if (!canResolve && !canRequestInfo) {
    return;
  }

  const { data: current } = await supabase
    .from("justifications")
    .select("student_id,status,title")
    .eq("id", id)
    .maybeSingle();

  if (!current) {
    return;
  }

  const { error } = await supabase.rpc("resolve_justification" as "get_teacher_directory", {
    p_justification_id: id,
    p_status: nextStatus,
    p_review_notes: reviewNotes || undefined,
  } as never);

  if (error) {
    // La funcion SQL redacta mensajes en espanol con estos codigos; cualquier
    // otro error es interno y no debe llegar al usuario.
    const isExplained = ["42501", "22023", "P0002"].includes(error.code ?? "");
    if (!isExplained) console.error("resolve_justification", error);
    redirect(
      `/justificaciones?error=${encodeURIComponent(
        isExplained ? error.message : "No se pudo actualizar la justificacion.",
      )}`,
    );
  }

  {
    const eventType =
      nextStatus === "approved"
        ? "justification.approved"
        : nextStatus === "rejected"
          ? "justification.rejected"
          : nextStatus === "requires_more_info"
            ? "justification.requires_more_info"
            : "justification.submitted";

    await supabase.rpc("emit_notification", {
      p_user_id: current.student_id,
      p_event_type: eventType,
      p_title: `Justificacion ${statusLabels[nextStatus].toLowerCase()}`,
      p_body: reviewNotes || `Tu solicitud "${current.title}" cambio a ${statusLabels[nextStatus]}.`,
      p_metadata: { justification_id: id, status: nextStatus },
      p_triggered_by: profile.id,
    });
  }

  revalidatePath("/justificaciones");
  revalidatePath("/dashboard");
}

async function respondToInfoRequest(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  if (profile.role !== "student") {
    redirect("/justificaciones?error=Solo el alumno puede responder a su solicitud.");
  }

  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const evidence = formData.get("evidence");
  const file = evidence instanceof File && evidence.size > 0 ? evidence : null;

  if (!id) {
    redirect("/justificaciones?error=Solicitud no valida.");
  }

  if (note.length < 10) {
    redirect("/justificaciones?error=Explica en al menos 10 caracteres que informacion agregas.");
  }

  // La evidencia se adjunta antes de mover el estado: si la subida falla, la
  // solicitud sigue esperando informacion y se puede reintentar.
  if (file) {
    const safeName = file.name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .slice(0, 120);
    const filePath = `${profile.id}/${id}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("evidencias_justificaciones")
      .upload(filePath, file, {
        cacheControl: "3600",
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("respondToInfoRequest upload", uploadError);
      redirect("/justificaciones?error=No pudimos subir la evidencia. Tu solicitud sigue esperando informacion.");
    }

    const { error: fileRowError } = await supabase.from("justification_files").insert({
      justification_id: id,
      file_name: file.name,
      file_path: filePath,
      content_type: file.type || "application/octet-stream",
      file_size_bytes: file.size,
    });

    if (fileRowError) {
      // El archivo ya esta en Storage pero no quedo registrado: se retira para
      // no dejar un adjunto huerfano y se pide reintentar sobre el mismo folio.
      console.error("respondToInfoRequest file row", fileRowError);
      await supabase.storage.from("evidencias_justificaciones").remove([filePath]);
      redirect("/justificaciones?error=No pudimos registrar la evidencia. Tu solicitud sigue esperando informacion; intentalo de nuevo.");
    }
  }

  const { error } = await supabase.rpc(
    "respond_to_justification_info_request" as "get_teacher_directory",
    { p_justification_id: id, p_note: note } as never,
  );

  if (error) {
    console.error("respondToInfoRequest", error);
    redirect("/justificaciones?error=No pudimos enviar tu respuesta. Intenta de nuevo.");
  }

  const { data: current } = await supabase
    .from("justifications")
    .select("title,reviewer_id")
    .eq("id", id)
    .maybeSingle();

  if (current?.reviewer_id) {
    await supabase.rpc("emit_notification", {
      p_user_id: current.reviewer_id,
      p_event_type: "justification.info_provided",
      p_title: "Informacion adicional recibida",
      p_body: `${profile.fullName} respondio a la solicitud sobre "${current.title}".`,
      p_metadata: { justification_id: id },
      p_triggered_by: profile.id,
    });
  }

  revalidatePath("/justificaciones");
  revalidatePath("/dashboard");
  redirect("/justificaciones?exito=Respuesta enviada. Tu solicitud volvio a la cola de revision.");
}

async function addReviewNote(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  const canAddNote =
    hasPermission(profile.role, "justifications:academic_note") ||
    hasPermission(profile.role, "justifications:tutor_followup") ||
    hasPermission(profile.role, "justifications:resolve");

  if (!canAddNote) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!id || !note) {
    return;
  }

  await supabase.from("justification_audit_events").insert({
    justification_id: id,
    actor_id: profile.id,
    event_type: "review_note",
    note,
  });

  revalidatePath("/justificaciones");
}

export default async function JustificacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; categoria?: string; q?: string; error?: string; exito?: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role === "teacher") redirect("/docente");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const canCreateJustification = profile.role === "student";
  const canResolveJustifications = hasPermission(profile.role, "justifications:resolve");
  const canRequestMoreInfo = hasPermission(profile.role, "justifications:tutor_followup") || canResolveJustifications;
  const canAddReviewNote =
    hasPermission(profile.role, "justifications:academic_note") ||
    hasPermission(profile.role, "justifications:tutor_followup") ||
    canResolveJustifications;

  let query = supabase
    .from("justifications")
    .select(`
      id,
      student_id,
      category,
      title,
      description,
      start_date,
      end_date,
      status,
      reviewer_id,
      review_notes,
      created_at,
      updated_at,
      folio,
      due_date,
      student:profiles!justifications_student_id_fkey(full_name,email),
      reviewer:profiles!justifications_reviewer_id_fkey(full_name,email)
    `)
    .order("created_at", { ascending: false })
    // A3 - la consulta no tenia limite: una bandeja grande generaba una pagina
    // de decenas de miles de pixeles. El historial completo se consulta filtrando.
    .limit(50);

  if (isStatus(params.estado ?? "")) {
    query = query.eq("status", params.estado as JustificationStatus);
  }

  if (isCategory(params.categoria ?? "")) {
    query = query.eq("category", params.categoria as JustificationCategory);
  }

  if (params.q) {
    const term = params.q.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term);

    if (isUuid) {
      // "Abrir tramite" desde notificaciones llega con el id del expediente.
      // Buscarlo como texto en titulo/descripcion no encontraba nada.
      query = query.eq("id", term);
    } else {
      // Comas y parentesis forman parte de la sintaxis de filtros de PostgREST:
      // se retiran para que un texto de busqueda no rompa la consulta.
      const safe = term.replace(/[,()]/g, " ").trim();
      if (safe) query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
    }
  }

  const [
    { data: justificationsData, error: justificationsError },
    { data: auditData },
    { data: filesData },
  ] = await Promise.all([
    query,
    supabase
      .from("justification_audit_events")
      .select(`
        id,
        justification_id,
        actor_id,
        event_type,
        from_status,
        to_status,
        note,
        created_at,
        actor:profiles!justification_audit_events_actor_id_fkey(full_name,email)
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("justification_files")
      .select("id, justification_id, file_name, file_path, content_type, file_size_bytes, uploaded_at")
      .order("uploaded_at", { ascending: false }),
  ]);

  const justifications = (justificationsData ?? []) as unknown as JustificationRow[];
  const auditEvents = (auditData ?? []) as unknown as AuditRow[];
  const files = (filesData ?? []) as FileRow[];
  const fileAccessEntries = await Promise.all(
    files.map(async (file) => {
      const [{ data: viewData }, { data: downloadData }] = await Promise.all([
        supabase.storage
          .from("evidencias_justificaciones")
          .createSignedUrl(file.file_path, 60 * 15),
        supabase.storage
          .from("evidencias_justificaciones")
          .createSignedUrl(file.file_path, 60 * 15, { download: file.file_name }),
      ]);

      return [file.id, { viewUrl: viewData?.signedUrl, downloadUrl: downloadData?.signedUrl }] as const;
    }),
  );
  const fileAccessById = new Map(fileAccessEntries);
  const auditByJustification = auditEvents.reduce<Map<string, AuditRow[]>>((acc, event) => {
    const current = acc.get(event.justification_id) ?? [];
    current.push(event);
    acc.set(event.justification_id, current);
    return acc;
  }, new Map());
  const filesByJustification = files.reduce<Map<string, FileRow[]>>((acc, file) => {
    const current = acc.get(file.justification_id) ?? [];
    current.push(file);
    acc.set(file.justification_id, current);
    return acc;
  }, new Map());

  // Panorama de los ultimos 6 meses, independiente de los filtros y del limite
  // de la lista. Agregado en servidor sobre lo que RLS deja ver a cada rol.
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayMs = new Date(todayKey).getTime();
  const monthStarts = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(todayMs);
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - (5 - index));
    return date;
  });
  const { data: metricRows } = await supabase
    .from("justifications")
    .select("category, status, submitted_at, updated_at")
    .gte("submitted_at", monthStarts[0].toISOString())
    .limit(500);
  const metrics = (metricRows ?? []) as Array<{ category: JustificationCategory; status: JustificationStatus | null; submitted_at: string; updated_at: string | null }>;
  const categorySlices = (Object.keys(categoryLabels) as JustificationCategory[]).map((category, index) => ({
    label: categoryLabels[category],
    value: metrics.filter((row) => row.category === category).length,
    color: ["var(--primary)", "var(--chart-sky)", "var(--chart-amber)"][index],
  }));
  const monthKey = (iso: string) => iso.slice(0, 7);
  const monthly = monthStarts.map((start) => {
    const key = start.toISOString().slice(0, 7);
    const rows = metrics.filter((row) => monthKey(row.submitted_at) === key);
    return {
      label: start.toLocaleDateString("es-MX", { month: "short", timeZone: "UTC" }),
      aprobadas: rows.filter((row) => row.status === "approved").length,
      rechazadas: rows.filter((row) => row.status === "rejected").length,
      enCurso: rows.filter((row) => row.status === "pending" || row.status === "requires_more_info").length,
    };
  });
  // Tiempo de respuesta: de la solicitud a la ultima actualizacion de las ya resueltas.
  const resolutionDays = metrics
    .filter((row) => (row.status === "approved" || row.status === "rejected") && row.updated_at)
    .map((row) => Math.max(0, (Date.parse(row.updated_at as string) - Date.parse(row.submitted_at)) / 86_400_000));
  const sortedDays = [...resolutionDays].sort((a, b) => a - b);
  const medianDays = sortedDays.length ? sortedDays[Math.floor(sortedDays.length / 2)] : null;
  const resolutionSegments = [
    { label: "Mismo día", value: resolutionDays.filter((days) => days < 1).length, color: "var(--tertiary)" },
    { label: "1 a 3 días", value: resolutionDays.filter((days) => days >= 1 && days < 3).length, color: "var(--primary)" },
    { label: "3 a 7 días", value: resolutionDays.filter((days) => days >= 3 && days < 7).length, color: "var(--chart-amber)" },
    { label: "Más de 7 días", value: resolutionDays.filter((days) => days >= 7).length, color: "var(--error)" },
  ];

  const pending = justifications.filter((item) => item.status === "pending").length;
  const needsInfo = justifications.filter((item) => item.status === "requires_more_info").length;
  const approved = justifications.filter((item) => item.status === "approved").length;
  const overdue = justifications.filter((item) => {
    return item.due_date && item.status === "pending" && item.due_date < new Date().toISOString().slice(0, 10);
  }).length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="rounded-lg border border-outline-variant bg-surface-container p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Trámites académicos</p>
            <h1 className="mt-2 text-2xl md:text-3xl font-headline font-bold text-on-surface">
              Centro de Justificaciones
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
              Solicitudes reales con folio, vencimiento, evidencias, revision por rol, auditoria y notificaciones.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Pendientes", pending],
              ["Observacion", needsInfo],
              ["Aprobadas", approved],
              ["Vencidas", overdue],
            ].map(([label, value]) => (
              <div key={label} className="rounded border border-outline-variant bg-surface px-4 py-3">
                <p className="text-[10px] font-semibold uppercase text-on-surface-variant">{label}</p>
                <p className="mt-1 text-2xl font-bold text-on-surface">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {justificationsError ? (
        <div className="rounded-lg border border-error/40 bg-error-container/20 p-4 text-sm text-on-error-container">
          No se pudieron consultar las justificaciones. Actualiza la pagina en unos segundos.
        </div>
      ) : null}
      {params.error ? <p role="alert" className="rounded-lg border border-error/40 bg-error-container p-4 text-sm font-semibold text-on-error-container">{params.error}</p> : null}
      {params.exito ? <p role="status" className="rounded-lg border border-tertiary/40 bg-tertiary-container/30 p-4 text-sm font-semibold text-on-tertiary-container">{params.exito}</p> : null}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 rounded-lg border border-outline-variant bg-surface-container p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Últimos 6 meses</p>
          <h2 className="text-sm font-bold text-on-surface">Por categoría</h2>
          <div className="mt-4">
            <DonutChart slices={categorySlices} centerLabel="solicitudes" size={130} emptyLabel="Sin solicitudes en el periodo." />
          </div>
        </div>
        <div className="min-w-0 rounded-lg border border-outline-variant bg-surface-container p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Volumen</p>
              <h2 className="text-sm font-bold text-on-surface">Solicitudes por mes</h2>
            </div>
            <ul className="flex flex-wrap gap-3 text-[11px] text-on-surface-variant">
              {[["Aprobadas", "var(--tertiary)"], ["Rechazadas", "var(--error)"], ["En curso", "var(--chart-amber)"]].map(([label, color]) => <li key={label} className="flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />{label}</li>)}
            </ul>
          </div>
          <div className="mt-3">
            <SignalTrend
              data={monthly}
              height={170}
              emptyLabel="Sin solicitudes en los últimos 6 meses."
              series={[
                { key: "aprobadas", label: "Aprobadas", color: "var(--tertiary)" },
                { key: "rechazadas", label: "Rechazadas", color: "var(--error)" },
                { key: "enCurso", label: "En curso", color: "var(--chart-amber)" },
              ]}
            />
          </div>
        </div>
        <div className="min-w-0 rounded-lg border border-outline-variant bg-surface-container p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Tiempo de respuesta</p>
          <h2 className="text-sm font-bold text-on-surface">De la solicitud a la resolución</h2>
          <p className="mt-3 text-3xl font-black text-on-surface">
            {medianDays === null ? "—" : medianDays < 1 ? "< 1" : Math.round(medianDays)}
            <span className="ml-1 text-sm font-semibold text-on-surface-variant">{medianDays === null ? "sin resueltas aún" : "días (mediana)"}</span>
          </p>
          <StackedBar className="mt-4" segments={resolutionSegments} emptyLabel="Aún no hay solicitudes resueltas en el periodo." />
          <p className="mt-3 text-[11px] text-on-surface-variant">Cuenta aprobadas y rechazadas según su última actualización.</p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <aside className="space-y-6">
          <form action="/justificaciones" className="rounded-lg border border-outline-variant bg-surface-container p-5">
            <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Filtros operativos</h2>
            <div className="mt-4 space-y-3">
              <input
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Buscar titulo o descripcion"
                className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
              />
              <select
                name="estado"
                defaultValue={params.estado ?? ""}
                className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
              >
                <option value="">Todos los estados</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                name="categoria"
                defaultValue={params.categoria ?? ""}
                className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
              >
                <option value="">Todas las categorias</option>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <SubmitButton className="w-full rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container" pendingLabel="Filtrando...">
                Aplicar filtros
              </SubmitButton>
            </div>
          </form>

          {canCreateJustification ? (
          <JustificationForm />
          ) : (
            <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
              <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Rol en justificaciones</h2>
              <p className="mt-3 text-sm text-on-surface-variant">
                {profile.role === "tutor"
                    ? "Da seguimiento al estudiante y puede solicitar informacion adicional antes de escalar."
                    : "Tutor o administracion resuelven el expediente con aprobacion, rechazo o solicitud de informacion."}
              </p>
            </section>
          )}
        </aside>

        <section className="space-y-4">
          {justifications.length === 0 && !justificationsError ? (
            <div className="rounded-lg border border-outline-variant bg-surface-container p-6 text-sm text-on-surface-variant">
              No hay justificaciones visibles para tu usuario.
            </div>
          ) : null}

          {justifications.map((item) => {
            const audit = auditByJustification.get(item.id) ?? [];
            const visibleAudit = audit
              .filter((event) => event.event_type === "review_note" || event.event_type === "status_changed")
              .slice(0, 3);
            const itemFiles = filesByJustification.get(item.id) ?? [];
            return (
              <article key={item.id} className="rounded-lg border border-outline-variant bg-surface-container p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-surface-container-highest px-2 py-1 text-[10px] font-semibold uppercase text-primary">
                        {item.folio ?? item.id.slice(0, 8)}
                      </span>
                      <span className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase ${statusClass(item.status ?? "pending")}`}>
                        {statusLabels[item.status ?? "pending"]}
                      </span>
                      <span className="rounded bg-surface px-2 py-1 text-[10px] font-semibold uppercase text-on-surface-variant">
                        {categoryLabels[item.category]}
                      </span>
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-on-surface">{item.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{item.description}</p>
                    <p className="mt-3 text-xs text-on-surface-variant">
                      {item.student?.full_name ?? item.student?.email ?? "Estudiante"} · {formatDate(item.start_date)} a {formatDate(item.end_date)}
                    </p>
                  </div>
                  <div className="rounded border border-outline-variant bg-surface p-3 text-xs text-on-surface-variant lg:min-w-[210px]">
                    <p><span className="font-semibold text-on-surface">Vence:</span> {formatDate(item.due_date)}</p>
                    <p className="mt-2"><span className="font-semibold text-on-surface">Revisor:</span> {item.reviewer?.full_name ?? item.reviewer?.email ?? "Sin asignar"}</p>
                    <p className="mt-2"><span className="font-semibold text-on-surface">Actualizada:</span> {formatDate(item.updated_at?.slice(0, 10))}</p>
                  </div>
                </div>

                {item.review_notes ? (
                  <div className="mt-4 rounded border border-outline-variant bg-surface p-3 text-sm text-on-surface-variant">
                    <span className="font-semibold text-on-surface">Nota de revision:</span> {item.review_notes}
                  </div>
                ) : null}

                {itemFiles.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {itemFiles.map((file) => {
                      const access = fileAccessById.get(file.id);
                      // Un nombre de archivo sin espacios no se parte: su contribucion
                      // intrinseca era 256 px (max-w-64) y forzaba el chip a ~416 px y, con
                      // el, toda la pagina movil. El tope relativo al viewport lo evita.
                      return (
                        <div key={file.id} className="flex max-w-full min-w-0 items-center gap-2 rounded border border-outline-variant bg-surface px-3 py-2 text-xs text-on-surface-variant">
                          <span className="min-w-0 max-w-[40vw] flex-1 truncate sm:max-w-64" title={file.file_name}>{file.file_name}</span>
                          {access?.viewUrl ? (
                            <FilePreviewModal fileName={file.file_name} contentType={file.content_type} url={access.viewUrl} />
                          ) : null}
                          {access?.downloadUrl ? (
                            <a href={access.downloadUrl} className="shrink-0 font-semibold text-primary hover:underline">
                              Descargar
                            </a>
                          ) : null}
                          {!access?.viewUrl && !access?.downloadUrl ? (
                            <span className="text-error">Sin acceso</span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {visibleAudit.length > 0 ? (
                  <details className="mt-4 rounded border border-outline-variant bg-surface p-4">
                    <summary className="cursor-pointer text-xs font-semibold uppercase text-on-surface-variant">
                      Seguimiento reciente
                    </summary>
                    <div className="mt-3 space-y-3">
                      {visibleAudit.map((event) => (
                        <div key={event.id} className="border-l-2 border-primary pl-3">
                          <p className="text-sm font-medium text-on-surface">{event.note ?? "Actualización del expediente"}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            {event.actor?.full_name ?? event.actor?.email ?? "Sistema"} · {new Date(event.created_at ?? "").toLocaleString("es-MX")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}

                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
                  <div className="rounded border border-outline-variant bg-surface p-4">
                    <h3 className="text-xs font-semibold uppercase text-on-surface-variant">Resumen operativo</h3>
                    <p className="mt-3 text-sm text-on-surface-variant">
                      {itemFiles.length > 0
                        ? `${itemFiles.length} evidencia(s) registradas para revisión.`
                        : "Sin evidencia adjunta registrada."}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {(canResolveJustifications || canRequestMoreInfo) && (item.status === "pending" || item.status === "requires_more_info") ? (
                      <form action={updateJustificationStatus} className="rounded border border-outline-variant bg-surface p-4">
                        <input type="hidden" name="id" value={item.id} />
                        <h3 className="text-xs font-semibold uppercase text-on-surface-variant">Revision</h3>
                        <textarea name="review_notes" rows={3} placeholder="Nota para el alumno" className="mt-3 w-full rounded border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface" />
                        <div className="mt-3 grid grid-cols-1 gap-2">
                          {canResolveJustifications ? (
                            <SubmitButton name="status" value="approved" className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800" pendingLabel="Aprobando...">
                              Aprobar
                            </SubmitButton>
                          ) : null}
                          {canRequestMoreInfo && item.status === "pending" ? (
                            <SubmitButton name="status" value="requires_more_info" className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800" pendingLabel="Enviando...">
                              Solicitar informacion
                            </SubmitButton>
                          ) : null}
                          {canResolveJustifications ? (
                            <SubmitButton name="status" value="rejected" className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800" pendingLabel="Rechazando...">
                              Rechazar
                            </SubmitButton>
                          ) : null}
                        </div>
                      </form>
                    ) : null}

                    {item.student_id === profile.id && item.status === "requires_more_info" ? (
                      <form action={respondToInfoRequest} className="rounded border border-amber-400/40 bg-amber-400/5 p-4">
                        <input type="hidden" name="id" value={item.id} />
                        <h3 className="text-xs font-semibold uppercase text-on-surface-variant">Tu tutor pidio mas informacion</h3>
                        <p className="mt-2 text-xs text-on-surface-variant">
                          Responde aqui sobre el mismo folio. No crees otra solicitud.
                        </p>
                        <textarea
                          name="note"
                          rows={3}
                          required
                          minLength={10}
                          placeholder="Que informacion agregas"
                          className="mt-3 w-full rounded border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface"
                        />
                        <label className="mt-3 block text-xs font-medium text-on-surface-variant">
                          Evidencia adicional (opcional)
                          <input
                            name="evidence"
                            type="file"
                            accept="application/pdf,image/jpeg,image/png"
                            className="mt-1 w-full rounded border border-outline-variant bg-surface-container px-3 py-2 text-xs text-on-surface file:mr-3 file:rounded file:border-0 file:bg-primary-container file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-on-primary-container"
                          />
                        </label>
                        <SubmitButton className="mt-3 w-full rounded bg-primary-container px-3 py-2 text-xs font-semibold text-on-primary-container" pendingLabel="Enviando...">
                          Enviar respuesta
                        </SubmitButton>
                      </form>
                    ) : null}

                    {canAddReviewNote ? (
                    <form action={addReviewNote} className="rounded border border-outline-variant bg-surface p-4">
                      <input type="hidden" name="id" value={item.id} />
                      <h3 className="text-xs font-semibold uppercase text-on-surface-variant">Agregar nota</h3>
                      <textarea name="note" rows={3} required placeholder="Comentario interno o seguimiento" className="mt-3 w-full rounded border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface" />
                      <SubmitButton className="mt-3 w-full rounded bg-surface-container-highest px-3 py-2 text-xs font-semibold text-on-surface" pendingLabel="Guardando...">
                        Guardar nota
                      </SubmitButton>
                    </form>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
