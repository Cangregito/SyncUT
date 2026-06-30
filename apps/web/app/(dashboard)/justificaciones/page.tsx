import { revalidatePath } from "next/cache";
import type { Tables } from "@plataforma/types";

import { requireProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type JustificationRow = Tables<"justifications">;
type JustificationFileRow = Tables<"justification_files">;
type JustificationStatus = NonNullable<JustificationRow["status"]>;
type ProfileSummary = {
  full_name: string | null;
  email: string;
};
type JustificationAuditRow = Tables<"justification_audit_events"> & {
  actor: ProfileSummary | null;
};

const statusLabels: Record<JustificationStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  requires_more_info: "Requiere informacion",
};

const categoryLabels: Record<JustificationRow["category"], string> = {
  medical: "Medica",
  official: "Oficial",
  personal: "Personal",
};

function isJustificationStatus(value: string): value is JustificationStatus {
  return ["pending", "approved", "rejected", "requires_more_info"].includes(value);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function attachEvidence(
  justificationId: string,
  studentId: string,
  evidence: File,
) {
  const supabase = await createSupabaseServerClient();
  const safeFileName = evidence.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${studentId}/${justificationId}/${Date.now()}-${safeFileName}`;
  const upload = await supabase.storage
    .from("evidencias_justificaciones")
    .upload(filePath, evidence, {
      contentType: evidence.type || "application/octet-stream",
      upsert: false,
    });

  if (upload.error) {
    return null;
  }

  const { data } = await supabase
    .from("justification_files")
    .insert({
      justification_id: justificationId,
      file_name: evidence.name,
      file_path: filePath,
      content_type: evidence.type || "application/octet-stream",
      file_size_bytes: evidence.size,
    })
    .select("id")
    .single();

  return data;
}

async function createJustification(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const category = String(formData.get("category") ?? "personal");
  const evidence = formData.get("evidence");
  const submittedAt = new Date();
  const dueDate = addDays(submittedAt, 3).toISOString().slice(0, 10);
  const folio = `JUS-${submittedAt.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  if (!title || !description || !startDate || !endDate || !(evidence instanceof File) || evidence.size === 0) {
    return;
  }

  const { data: justification, error: insertError } = await supabase
    .from("justifications")
    .insert({
      student_id: profile.id,
      title,
      description,
      start_date: startDate,
      end_date: endDate,
      category: category === "medical" || category === "official" || category === "personal" ? category : "personal",
      folio,
      due_date: dueDate,
      submitted_at: submittedAt.toISOString(),
    })
    .select("id, folio, due_date")
    .single();

  if (insertError || !justification) {
    return;
  }

  const file = await attachEvidence(justification.id, profile.id, evidence);

  await supabase.from("justification_audit_events").insert({
    justification_id: justification.id,
    actor_id: profile.id,
    event_type: "submitted",
    to_status: "pending",
    note: file ? "Solicitud enviada con evidencia inicial." : "Solicitud enviada sin poder registrar evidencia.",
  });
  await supabase.rpc("emit_notification", {
    p_user_id: profile.id,
    p_event_type: "justification.submitted",
    p_title: "Justificación enviada",
    p_body: `Tu solicitud "${title}" fue registrada con folio ${justification.folio} y vence el ${justification.due_date}.`,
    p_metadata: {
      justification_id: justification.id,
      folio: justification.folio,
      due_date: justification.due_date,
    },
    p_triggered_by: profile.id,
  });

  revalidatePath("/justificaciones");
  revalidatePath("/dashboard");
}

async function addEvidence(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const justificationId = String(formData.get("justification_id") ?? "");
  const evidence = formData.get("evidence");

  if (!justificationId || !(evidence instanceof File) || evidence.size === 0) {
    return;
  }

  const { data: justification } = await supabase
    .from("justifications")
    .select("id, student_id, status")
    .eq("id", justificationId)
    .maybeSingle();

  if (!justification || justification.student_id !== profile.id || !["pending", "requires_more_info"].includes(justification.status ?? "")) {
    return;
  }

  const file = await attachEvidence(justificationId, profile.id, evidence);

  if (file) {
    await supabase.from("justification_audit_events").insert({
      justification_id: justificationId,
      actor_id: profile.id,
      event_type: "file_added",
      note: `Evidencia agregada: ${evidence.name}`,
    });
    await supabase.rpc("emit_notification", {
      p_user_id: profile.id,
      p_event_type: "justification.file_added",
      p_title: "Evidencia agregada",
      p_body: `Se agregó la evidencia "${evidence.name}" a tu justificación.`,
      p_metadata: {
        justification_id: justificationId,
      },
      p_triggered_by: profile.id,
    });
  }

  revalidatePath("/justificaciones");
}

async function reviewJustification(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const reviewNotes = String(formData.get("review_notes") ?? "").trim();

  if (!id || !isJustificationStatus(status) || status === "pending") {
    return;
  }

  const { data: current } = await supabase
    .from("justifications")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (!current || ["approved", "rejected"].includes(current.status ?? "")) {
    return;
  }

  const { error } = await supabase
    .from("justifications")
    .update({
      status,
      reviewer_id: profile.id,
      review_notes: reviewNotes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (!error) {
    await supabase.from("justification_audit_events").insert({
      justification_id: id,
      actor_id: profile.id,
      event_type: "status_changed",
      from_status: current.status,
      to_status: status,
      note: reviewNotes || `Cambio de estado a ${statusLabels[status]}.`,
    });
    const { data: reviewed } = await supabase
      .from("justifications")
      .select("student_id, title")
      .eq("id", id)
      .maybeSingle();

    if (reviewed) {
      const eventType =
        status === "requires_more_info"
          ? "justification.requires_more_info"
          : status === "approved"
            ? "justification.approved"
            : "justification.rejected";

      await supabase.rpc("emit_notification", {
        p_user_id: reviewed.student_id,
        p_event_type: eventType,
        p_title: `Justificación ${statusLabels[status].toLowerCase()}`,
        p_body: reviewNotes || `Tu solicitud "${reviewed.title}" cambió a ${statusLabels[status]}.`,
        p_metadata: {
          justification_id: id,
          status,
        },
        p_triggered_by: profile.id,
      });
    }
  }

  revalidatePath("/justificaciones");
  revalidatePath("/dashboard");
}

export default async function JustificacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const canReview = ["admin", "coordinator"].includes(profile.role);
  const today = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("justifications")
    .select("id, student_id, category, title, description, start_date, end_date, status, reviewer_id, review_notes, folio, due_date, submitted_at, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (params.estado === "vencidas") {
    query = query
      .lt("due_date", today)
      .in("status", ["pending", "requires_more_info"]);
  } else if (params.estado && isJustificationStatus(params.estado)) {
    query = query.eq("status", params.estado);
  }

  const { data, error } = await query;
  const requests = (data ?? []) as JustificationRow[];
  const pendingCount = requests.filter((item) => ["pending", "requires_more_info"].includes(item.status ?? "")).length;
  const overdueCount = requests.filter((item) => item.due_date < today && ["pending", "requires_more_info"].includes(item.status ?? "")).length;
  const { data: fileData } = requests.length
    ? await supabase
        .from("justification_files")
        .select("id, justification_id, file_name, file_path, content_type, file_size_bytes, uploaded_at")
        .in("justification_id", requests.map((item) => item.id))
    : { data: [] };
  const files = (fileData ?? []) as JustificationFileRow[];
  const filesByJustification = files.reduce<Map<string, JustificationFileRow[]>>((acc, file) => {
    const current = acc.get(file.justification_id) ?? [];
    current.push(file);
    acc.set(file.justification_id, current);
    return acc;
  }, new Map());
  const signedUrls = new Map<string, string>();
  await Promise.all(
    files.map(async (file) => {
      const { data: signed } = await supabase.storage
        .from("evidencias_justificaciones")
        .createSignedUrl(file.file_path, 60 * 10);
      if (signed?.signedUrl) {
        signedUrls.set(file.id, signed.signedUrl);
      }
    }),
  );
  const { data: auditData } = requests.length
    ? await supabase
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
        .in("justification_id", requests.map((item) => item.id))
        .order("created_at", { ascending: false })
    : { data: [] };
  const auditEvents = (auditData ?? []) as unknown as JustificationAuditRow[];
  const auditByJustification = auditEvents.reduce<Map<string, JustificationAuditRow[]>>((acc, event) => {
    const current = acc.get(event.justification_id) ?? [];
    current.push(event);
    acc.set(event.justification_id, current);
    return acc;
  }, new Map());

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Squad 1</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-headline font-bold text-on-surface">
          Justificaciones de Faltas
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Solicitudes guardadas en Supabase con reglas RLS por usuario y rol.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <form action={createJustification} className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Nueva solicitud</h2>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-on-surface-variant">
              Titulo
              <input name="title" required className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
            </label>
            <label className="block text-xs font-medium text-on-surface-variant">
              Categoria
              <select name="category" className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface">
                <option value="medical">Medica</option>
                <option value="official">Oficial</option>
                <option value="personal">Personal</option>
              </select>
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-on-surface-variant">
                Inicio
                <input name="start_date" type="date" required className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
              </label>
              <label className="block text-xs font-medium text-on-surface-variant">
                Fin
                <input name="end_date" type="date" required className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
              </label>
            </div>
            <label className="block text-xs font-medium text-on-surface-variant">
              Descripcion
              <textarea name="description" required rows={4} className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
            </label>
            <label className="block text-xs font-medium text-on-surface-variant">
              Evidencia
              <input
                name="evidence"
                type="file"
                required
                accept="application/pdf,image/jpeg,image/png"
                className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface file:mr-3 file:rounded file:border-0 file:bg-primary-container file:px-3 file:py-1 file:text-xs file:font-semibold file:text-on-primary-container"
              />
            </label>
          </div>
          <button type="submit" className="mt-4 w-full rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container hover:bg-primary">
            Enviar solicitud
          </button>
        </form>

        <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Solicitudes registradas</h2>
              <p className="mt-1 text-xs text-on-surface-variant">
                {requests.length} visibles · {pendingCount} pendientes · {overdueCount} vencidas
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="/justificaciones" className="rounded border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant">
                Todas
              </a>
              <a href="/justificaciones?estado=pending" className="rounded border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant">
                Pendientes
              </a>
              <a href="/justificaciones?estado=vencidas" className="rounded border border-error px-3 py-2 text-xs font-semibold text-error">
                Vencidas
              </a>
            </div>
          </div>

          {error ? (
            <p className="mt-4 rounded border border-error/40 bg-error-container/20 p-3 text-sm text-on-error-container">
              {error.message}
            </p>
          ) : null}

          <div className="mt-4 space-y-3">
            {requests.length === 0 && !error ? (
              <p className="rounded border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant">
                No hay justificaciones visibles para tu usuario.
              </p>
            ) : null}

            {requests.map((item) => (
              <article key={item.id} className="rounded border border-outline-variant bg-surface p-4">
                {(() => {
                  const itemFiles = filesByJustification.get(item.id) ?? [];
                  const itemAudit = auditByJustification.get(item.id) ?? [];
                  const canAddEvidence = item.student_id === profile.id && ["pending", "requires_more_info"].includes(item.status ?? "");
                  return (
                    <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-on-surface">{item.title}</h3>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {item.folio} | {categoryLabels[item.category]} | {item.start_date} a {item.end_date}
                    </p>
                    <p className={`mt-1 text-xs ${item.due_date < today && ["pending", "requires_more_info"].includes(item.status ?? "") ? "text-error" : "text-on-surface-variant"}`}>
                      Vence: {item.due_date}
                    </p>
                  </div>
                  <span className="rounded bg-surface-container-highest px-2 py-1 text-[10px] font-semibold uppercase text-primary">
                    {statusLabels[item.status ?? "pending"]}
                  </span>
                </div>
                <p className="mt-3 text-sm text-on-surface-variant">{item.description}</p>
                {itemFiles.length > 0 ? (
                  <div className="mt-3 rounded border border-outline-variant bg-surface-container p-3">
                    <p className="text-xs font-semibold uppercase text-on-surface-variant">Evidencias</p>
                    <div className="mt-2 space-y-2">
                      {itemFiles.map((file) => (
                        <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
                          <span>{file.file_name} ({Math.ceil(file.file_size_bytes / 1024)} KB)</span>
                          {signedUrls.get(file.id) ? (
                            <a className="font-semibold text-primary" href={signedUrls.get(file.id)} target="_blank" rel="noreferrer">
                              Abrir
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-error">Sin evidencia visible para esta solicitud.</p>
                )}
                {item.review_notes ? (
                  <p className="mt-2 text-xs text-on-surface-variant">Revision: {item.review_notes}</p>
                ) : null}

                {canAddEvidence ? (
                  <form action={addEvidence} className="mt-4 rounded border border-outline-variant bg-surface-container p-3">
                    <input type="hidden" name="justification_id" value={item.id} />
                    <p className="text-xs font-semibold uppercase text-on-surface-variant">Agregar evidencia</p>
                    <input
                      name="evidence"
                      type="file"
                      required
                      accept="application/pdf,image/jpeg,image/png"
                      className="mt-3 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface file:mr-3 file:rounded file:border-0 file:bg-primary-container file:px-3 file:py-1 file:text-xs file:font-semibold file:text-on-primary-container"
                    />
                    <button className="mt-3 rounded border border-primary px-3 py-2 text-xs font-semibold text-primary">
                      Subir evidencia
                    </button>
                  </form>
                ) : null}

                {canReview && ["pending", "requires_more_info"].includes(item.status ?? "") ? (
                  <form action={reviewJustification} className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input type="hidden" name="id" value={item.id} />
                    <input
                      name="review_notes"
                      placeholder="Nota de revision"
                      className="min-w-0 flex-1 rounded border border-outline-variant bg-surface-container px-3 py-2 text-xs text-on-surface"
                    />
                    <button name="status" value="approved" className="rounded border border-primary px-3 py-2 text-xs font-semibold text-primary">
                      Aprobar
                    </button>
                    <button name="status" value="requires_more_info" className="rounded border border-outline px-3 py-2 text-xs font-semibold text-on-surface-variant">
                      Pedir info
                    </button>
                    <button name="status" value="rejected" className="rounded border border-error px-3 py-2 text-xs font-semibold text-error">
                      Rechazar
                    </button>
                  </form>
                ) : null}
                {itemAudit.length > 0 ? (
                  <details className="mt-4 rounded border border-outline-variant bg-surface-container p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase text-on-surface-variant">
                      Bitacora ({itemAudit.length})
                    </summary>
                    <div className="mt-3 space-y-2">
                      {itemAudit.map((event) => (
                        <div key={event.id} className="border-t border-outline-variant pt-2 first:border-t-0 first:pt-0">
                          <p className="text-xs text-on-surface-variant">
                            {event.event_type}
                            {event.from_status && event.to_status ? ` · ${statusLabels[event.from_status]} -> ${statusLabels[event.to_status]}` : ""}
                          </p>
                          {event.note ? <p className="mt-1 text-sm text-on-surface-variant">{event.note}</p> : null}
                          <p className="mt-1 text-[11px] text-on-surface-variant">
                            {event.actor?.full_name ?? event.actor?.email ?? "Sistema"}
                            {event.created_at ? ` | ${new Date(event.created_at).toLocaleString("es-MX")}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
                    </>
                  );
                })()}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
