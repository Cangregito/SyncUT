import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Tables } from "@plataforma/types";

import { requireProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Priority = Tables<"incidents">["priority"];
type IncidentStatus = Tables<"incidents">["status"];

type ProfileSummary = {
  full_name: string | null;
  email: string;
};

type IncidentRow = Tables<"incidents"> & {
  reporter: ProfileSummary | null;
  assignee: ProfileSummary | null;
  related_teacher?: ProfileSummary | null;
};

type IncidentCommentRow = Tables<"incident_comments"> & {
  author: ProfileSummary | null;
};

type IncidentAuditRow = Tables<"incident_audit_events"> & {
  actor: ProfileSummary | null;
  assignee: ProfileSummary | null;
};

type StaffProfile = Pick<Tables<"profiles">, "id" | "full_name" | "email" | "role">;
type IncidentCategory = NonNullable<Tables<"incidents">["category"]>;

const priorityLabels: Record<Priority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

const statusLabels: Record<IncidentStatus, string> = {
  abierta: "Abierta",
  en_proceso: "En proceso",
  resuelta: "Resuelta",
  cerrada: "Cerrada",
};

const categoryLabels: Record<IncidentCategory, string> = {
  academica: "Académica",
  tecnica: "Técnica",
  administrativa: "Administrativa",
  bienestar: "Bienestar",
  seguridad: "Seguridad",
};

function isPriority(value: string | undefined): value is Priority {
  return value === "alta" || value === "media" || value === "baja";
}

function isIncidentStatus(value: string | undefined): value is IncidentStatus {
  return value === "abierta" || value === "en_proceso" || value === "resuelta" || value === "cerrada";
}

function isIncidentCategory(value: string | undefined): value is IncidentCategory {
  return value === "academica" || value === "tecnica" || value === "administrativa" || value === "bienestar" || value === "seguridad";
}

function getSlaState(dueAt: string | null, status: IncidentStatus) {
  if (!dueAt || ["resuelta", "cerrada"].includes(status)) return "neutral";
  return Date.parse(dueAt) < Date.now() ? "overdue" : "active";
}

function isUsefulText(value: string, minLength: number) {
  return value.trim().replace(/\s+/g, " ").length >= minLength;
}

async function createIncident(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  if (profile.role !== "student") {
    return;
  }

  const supabase = await createSupabaseServerClient();

  const title = String(formData.get("title") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priorityValue = String(formData.get("priority") ?? "media");
  const priority = isPriority(priorityValue) ? priorityValue : "media";
  const categoryValue = String(formData.get("category") ?? "academica");
  const category = isIncidentCategory(categoryValue) ? categoryValue : "academica";
  const teamId = String(formData.get("team_id") ?? "");
  const relatedTeacherId = String(formData.get("related_teacher_id") ?? "") || null;

  if (!teamId || !isUsefulText(title, 5) || !isUsefulText(area, 3) || !isUsefulText(description, 15)) {
    return;
  }

  const { data: incident } = await supabase
    .from("incidents")
    .insert({
      reported_by: profile.id,
      title,
      area,
      description,
      priority,
      category,
      team_id: teamId,
      related_teacher_id: relatedTeacherId,
    } as never)
    .select("id")
    .single();

  if (incident) {
    await supabase.from("incident_audit_events").insert({
      incident_id: incident.id,
      actor_id: profile.id,
      event_type: "created",
      to_status: "abierta",
      to_priority: priority,
      note: "Incidencia registrada desde el portal.",
    });
    await supabase.rpc("emit_notification", {
      p_user_id: profile.id,
      p_event_type: "incident.created",
      p_title: "Incidencia registrada",
      p_body: `Tu reporte "${title}" fue registrado con prioridad ${priorityLabels[priority]}.`,
      p_metadata: {
        incident_id: incident.id,
        priority,
      },
      p_triggered_by: profile.id,
    });
  }

  revalidatePath("/incidencias");
  revalidatePath("/dashboard");
}

async function assignIncident(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  if (!hasPermission(profile.role, "incidents:assign")) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const incidentId = String(formData.get("incident_id") ?? "");
  const assignedTo = String(formData.get("assigned_to") ?? "");

  if (!incidentId || !assignedTo) {
    return;
  }

  const { data: incident } = await supabase
    .from("incidents")
    .select("reported_by, assigned_to, title, status")
    .eq("id", incidentId)
    .maybeSingle();

  if (!incident || ["resuelta", "cerrada"].includes(incident.status)) {
    return;
  }

  const { error } = await supabase
    .from("incidents")
    .update({
      assigned_to: assignedTo,
      status: "en_proceso",
      first_response_at: new Date().toISOString(),
    })
    .eq("id", incidentId);

  if (!error) {
    await supabase.from("incident_audit_events").insert({
      incident_id: incidentId,
      actor_id: profile.id,
      event_type: "assigned",
      from_status: "abierta",
      to_status: "en_proceso",
      assigned_to: assignedTo,
      note: "Incidencia asignada para seguimiento.",
    });

    await supabase.rpc("emit_notification", {
      p_user_id: assignedTo,
      p_event_type: "incident.assigned",
      p_title: "Incidencia asignada",
      p_body: `Se te asignó el reporte "${incident.title}".`,
      p_metadata: {
        incident_id: incidentId,
      },
      p_triggered_by: profile.id,
    });
  }

  revalidatePath("/incidencias");
  revalidatePath("/dashboard");
}

async function updateIncidentStatus(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const resolutionSummary = String(formData.get("resolution_summary") ?? "").trim();

  if (!id || !isIncidentStatus(status)) {
    return;
  }

  const { data: incident } = await supabase
    .from("incidents")
    .select("reported_by, assigned_to, status, title")
    .eq("id", id)
    .maybeSingle();

  if (!incident) {
    return;
  }

  if (["resuelta", "cerrada"].includes(incident.status)) {
    return;
  }

  const canResolveByPermission = hasPermission(profile.role, "incidents:resolve");
  const { data: tutorAssignment } = profile.role === "tutor"
    ? await supabase
        .from("tutorship_assignments")
        .select("id")
        .eq("tutor_id", profile.id)
        .eq("student_id", incident.reported_by)
        .eq("status", "active")
        .maybeSingle()
    : { data: null };
  const canCloseAsDirectTutor = profile.role === "tutor" && status === "cerrada" && Boolean(tutorAssignment);

  if (!canResolveByPermission && !canCloseAsDirectTutor) {
    return;
  }

  if (["resuelta", "cerrada"].includes(status) && !isUsefulText(resolutionSummary, 15)) {
    return;
  }

  const { error } = await supabase
    .from("incidents")
    .update({
      status,
      updated_at: new Date().toISOString(),
      resolved_at: ["resuelta", "cerrada"].includes(status) ? new Date().toISOString() : null,
      closed_at: status === "cerrada" ? new Date().toISOString() : null,
      resolution_summary: ["resuelta", "cerrada"].includes(status) ? resolutionSummary : null,
    })
    .eq("id", id);

  if (!error) {
    await supabase.from("incident_audit_events").insert({
      incident_id: id,
      actor_id: profile.id,
      event_type: status === "resuelta" ? "resolved" : status === "cerrada" ? "closed" : "status_changed",
      from_status: incident.status,
      to_status: status,
      note: resolutionSummary || `Cambio de estado a ${statusLabels[status]}.`,
    });
    const targetUserId = profile.id === incident.reported_by ? incident.assigned_to : incident.reported_by;
    if (targetUserId) {
      await supabase.rpc("emit_notification", {
        p_user_id: targetUserId,
        p_event_type: status === "resuelta" ? "incident.resolved" : status === "cerrada" ? "incident.closed" : "incident.status_changed",
        p_title: `Incidencia ${statusLabels[status].toLowerCase()}`,
        p_body: `El reporte "${incident.title}" cambió a ${statusLabels[status]}.`,
        p_metadata: {
          incident_id: id,
          from_status: incident.status,
          to_status: status,
        },
        p_triggered_by: profile.id,
      });
    }
  }

  revalidatePath("/incidencias");
  revalidatePath("/dashboard");
}

async function createIncidentComment(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const incidentId = String(formData.get("incident_id") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();

  if (!incidentId || !comment) {
    return;
  }

  const { data: visibleIncident } = await supabase
    .from("incidents")
    .select("reported_by, assigned_to")
    .eq("id", incidentId)
    .maybeSingle();

  const canComment =
    visibleIncident &&
    (visibleIncident.reported_by === profile.id ||
      hasPermission(profile.role, "incidents:comment") ||
      hasPermission(profile.role, "incidents:resolve"));

  if (!canComment) {
    return;
  }

  const { error } = await supabase.from("incident_comments").insert({
    incident_id: incidentId,
    author_id: profile.id,
    comment,
  });

  if (!error) {
    await supabase.from("incident_audit_events").insert({
      incident_id: incidentId,
      actor_id: profile.id,
      event_type: "comment_added",
      note: comment,
    });
    const { data: incident } = await supabase
      .from("incidents")
      .select("reported_by, assigned_to, title")
      .eq("id", incidentId)
      .maybeSingle();

    const targetUserId = incident
      ? profile.id === incident.reported_by
        ? incident.assigned_to
        : incident.reported_by
      : null;

    if (targetUserId) {
      await supabase.rpc("emit_notification", {
        p_user_id: targetUserId,
        p_event_type: "incident.comment_added",
        p_title: "Nuevo comentario en incidencia",
        p_body: `Se agregó seguimiento al reporte "${incident?.title ?? "Incidencia"}".`,
        p_metadata: {
          incident_id: incidentId,
        },
        p_triggered_by: profile.id,
      });
    }
  }

  revalidatePath("/incidencias");
}

export default async function IncidenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ priority?: string; status?: string; sla?: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role === "teacher") redirect("/docente");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const canCreateIncident = profile.role === "student";
  const canAssignIncident = hasPermission(profile.role, "incidents:assign");
  const canResolveIncident = hasPermission(profile.role, "incidents:resolve");
  const canCommentIncident =
    hasPermission(profile.role, "incidents:comment") ||
    canAssignIncident ||
    canResolveIncident;

  let query = supabase
    .from("incidents")
    .select(`
      id,
      reported_by,
      assigned_to,
      title,
      area,
      category,
      description,
      priority,
      status,
      sla_due_at,
      first_response_at,
      resolution_summary,
      created_at,
      updated_at,
      resolved_at,
      closed_at,
      team_id,
      related_teacher_id,
      reporter:profiles!incidents_reported_by_fkey(full_name,email),
      assignee:profiles!incidents_assigned_to_fkey(full_name,email),
      related_teacher:profiles!incidents_related_teacher_id_fkey(full_name,email)
    `)
    .order("created_at", { ascending: false });

  if (isPriority(params.priority)) {
    query = query.eq("priority", params.priority);
  }

  if (isIncidentStatus(params.status)) {
    query = query.eq("status", params.status);
  }

  const { data, error } = await query;
  let incidents = (data ?? []) as unknown as IncidentRow[];
  if (params.sla === "vencidas") {
    incidents = incidents.filter((incident) => getSlaState(incident.sla_due_at, incident.status) === "overdue");
  }
  const { data: commentsData } = incidents.length
    ? await supabase
        .from("incident_comments")
        .select(`
          id,
          incident_id,
          author_id,
          comment,
          created_at,
          author:profiles!incident_comments_author_id_fkey(full_name,email)
        `)
        .in("incident_id", incidents.map((item) => item.id))
        .order("created_at", { ascending: true })
    : { data: [] };
  const comments = (commentsData ?? []) as unknown as IncidentCommentRow[];
  const [{ data: staffData }, { data: auditData }, { data: tutorAssignmentsData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", ["admin", "teacher", "tutor"])
      .order("full_name", { ascending: true }),
    incidents.length
      ? supabase
          .from("incident_audit_events")
          .select(`
            id,
            incident_id,
            actor_id,
            event_type,
            from_status,
            to_status,
            from_priority,
            to_priority,
            assigned_to,
            note,
            created_at,
            actor:profiles!incident_audit_events_actor_id_fkey(full_name,email),
            assignee:profiles!incident_audit_events_assigned_to_fkey(full_name,email)
          `)
          .in("incident_id", incidents.map((item) => item.id))
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    profile.role === "tutor"
      ? supabase
          .from("tutorship_assignments")
          .select("student_id")
          .eq("tutor_id", profile.id)
          .eq("status", "active")
      : Promise.resolve({ data: [] }),
  ]);
  const staff = (staffData ?? []) as StaffProfile[];
  const { data: studentMembershipData } = profile.role === "student"
    ? await supabase.from("tutor_team_members").select("team_id,team:tutor_teams!inner(id,name)").eq("student_id", profile.id).eq("status", "active").maybeSingle()
    : { data: null };
  const studentMembership = studentMembershipData as unknown as { team_id: string; team: { id: string; name: string } } | null;
  const { data: linkedTeacherData } = studentMembership
    ? await supabase.from("tutor_team_teachers" as "notifications").select("teacher_id,teacher:profiles!tutor_team_teachers_teacher_id_fkey(full_name,email)").eq("team_id" as "id", studentMembership.team_id)
    : { data: [] };
  const linkedTeachers = (linkedTeacherData ?? []) as unknown as Array<{ teacher_id: string; teacher: ProfileSummary | null }>;
  const auditEvents = (auditData ?? []) as unknown as IncidentAuditRow[];
  const directTutorStudentIds = new Set((tutorAssignmentsData ?? []).map((item) => item.student_id));
  const commentsByIncident = comments.reduce<Map<string, IncidentCommentRow[]>>((acc, comment) => {
    const current = acc.get(comment.incident_id) ?? [];
    current.push(comment);
    acc.set(comment.incident_id, current);
    return acc;
  }, new Map());
  const auditByIncident = auditEvents.reduce<Map<string, IncidentAuditRow[]>>((acc, event) => {
    const current = acc.get(event.incident_id) ?? [];
    current.push(event);
    acc.set(event.incident_id, current);
    return acc;
  }, new Map());
  const activeCount = incidents.filter((incident) => ["abierta", "en_proceso"].includes(incident.status)).length;
  const overdueCount = incidents.filter((incident) => getSlaState(incident.sla_due_at, incident.status) === "overdue").length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Squad 5</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-headline font-bold text-on-surface">
          Buzon de Incidencias
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Reportes guardados en `public.incidents` con semaforo por prioridad.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <p className="text-xs uppercase text-on-surface-variant">Activas</p>
          <p className="mt-2 text-3xl font-bold text-on-surface">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <p className="text-xs uppercase text-on-surface-variant">SLA vencido</p>
          <p className="mt-2 text-3xl font-bold text-error">{overdueCount}</p>
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <p className="text-xs uppercase text-on-surface-variant">Staff disponible</p>
          <p className="mt-2 text-3xl font-bold text-primary">{staff.length}</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        {canCreateIncident ? (
        <form action={createIncident} className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Nuevo reporte</h2>
          {!studentMembership ? <p className="mt-4 rounded border border-error/40 bg-error-container p-3 text-sm text-on-error-container">Primero debes unirte a un equipo tutorial para registrar una incidencia.</p> : <><input type="hidden" name="team_id" value={studentMembership.team_id}/><p className="mt-3 rounded border border-outline-variant bg-surface p-3 text-xs text-on-surface-variant">Equipo: <b className="text-on-surface">{studentMembership.team.name}</b></p></>}
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-on-surface-variant">
              Titulo
              <input name="title" required minLength={5} maxLength={120} className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
            </label>
            <label className="block text-xs font-medium text-on-surface-variant">
              Area afectada
              <input name="area" required minLength={3} maxLength={120} className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
            </label>
            <label className="block text-xs font-medium text-on-surface-variant">
              Categoria
              <select name="category" className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface">
                <option value="academica">Académica</option>
                <option value="tecnica">Técnica</option>
                <option value="administrativa">Administrativa</option>
                <option value="bienestar">Bienestar</option>
                <option value="seguridad">Seguridad</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-on-surface-variant">
              Prioridad
              <select name="priority" className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface">
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-on-surface-variant">
              Docente relacionado (opcional)
              <select name="related_teacher_id" disabled={!studentMembership} className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface disabled:opacity-50"><option value="">Ningún docente / No aplica</option>{linkedTeachers.map((item)=><option key={item.teacher_id} value={item.teacher_id}>{item.teacher?.full_name ?? item.teacher?.email}</option>)}</select>
              <span className="mt-1 block text-[10px]">Solo aparecen docentes vinculados por el tutor a tu equipo.</span>
            </label>
            <label className="block text-xs font-medium text-on-surface-variant">
              Descripcion
              <textarea name="description" required minLength={15} rows={4} className="mt-1 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
            </label>
          </div>
          <button type="submit" disabled={!studentMembership} className="mt-4 w-full rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container hover:bg-primary disabled:opacity-50">
            Reportar incidencia
          </button>
        </form>
        ) : (
          <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
            <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Rol en incidencias</h2>
            <p className="mt-3 text-sm text-on-surface-variant">
              {profile.role === "tutor"
                ? "Asigna responsables, da seguimiento tutorial y a SLA, y resuelve incidencias institucionales de sus alumnos."
                : "Supervisa la bitacora completa y puede cerrar casos criticos."}
            </p>
          </section>
        )}

        <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Incidencias visibles</h2>
            <div className="flex gap-2 text-xs">
              <a href="/incidencias" className="rounded border border-outline-variant px-3 py-1 text-on-surface-variant">Todas</a>
              <a href="/incidencias?status=abierta" className="rounded border border-outline-variant px-3 py-1 text-on-surface-variant">Abiertas</a>
              <a href="/incidencias?sla=vencidas" className="rounded border border-error px-3 py-1 text-error">SLA vencido</a>
              <a href="/incidencias?priority=alta" className="rounded border border-error px-3 py-1 text-error">Alta</a>
            </div>
          </div>

          {error ? (
            <p className="mt-4 rounded border border-error/40 bg-error-container/20 p-3 text-sm text-on-error-container">
              {error.message}
            </p>
          ) : null}

          <div className="mt-4 space-y-3">
            {incidents.length === 0 && !error ? (
              <p className="rounded border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant">
                No hay incidencias visibles con los filtros actuales.
              </p>
            ) : null}

            {incidents.map((item) => (
              <article key={item.id} className="rounded border border-outline-variant bg-surface p-4">
                {(() => {
                  const incidentComments = commentsByIncident.get(item.id) ?? [];
                  const incidentAudit = auditByIncident.get(item.id) ?? [];
                  const slaState = getSlaState(item.sla_due_at, item.status);
                  const isFinalStatus = item.status === "resuelta" || item.status === "cerrada";
                  return (
                    <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-on-surface">{item.title}</h3>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {item.area} | {item.created_at ? new Date(item.created_at).toLocaleString("es-MX") : "Sin fecha"}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {categoryLabels[item.category ?? "academica"]}
                      {item.sla_due_at ? ` | SLA: ${new Date(item.sla_due_at).toLocaleString("es-MX")}` : ""}
                      {slaState === "overdue" ? " | Vencida" : ""}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Reporta: {item.reporter?.full_name ?? item.reporter?.email ?? "Usuario visible por RLS"}
                      {item.assignee ? ` | Asignado: ${item.assignee.full_name ?? item.assignee.email}` : ""}
                    </p>
                    {item.related_teacher ? <p className="mt-1 text-xs font-semibold text-primary">Docente relacionado: {item.related_teacher.full_name ?? item.related_teacher.email}</p> : null}
                  </div>
                  <span className="rounded bg-surface-container-highest px-2 py-1 text-[10px] font-semibold uppercase text-primary">
                    {priorityLabels[item.priority]} | {statusLabels[item.status]}
                  </span>
                </div>
                <p className="mt-3 text-sm text-on-surface-variant">{item.description}</p>
                {item.resolution_summary ? (
                  <p className="mt-3 rounded border border-primary/40 bg-primary-container/10 p-3 text-sm text-on-surface-variant">
                    Resolución: {item.resolution_summary}
                  </p>
                ) : null}

                {!isFinalStatus && (canAssignIncident || canResolveIncident || directTutorStudentIds.has(item.reported_by)) ? (
                  <div className="mt-4 space-y-3">
                  {canAssignIncident ? (
                  <form action={assignIncident} className="flex flex-col gap-2 sm:flex-row">
                    <input type="hidden" name="incident_id" value={item.id} />
                    <select name="assigned_to" className="min-w-0 flex-1 rounded border border-outline-variant bg-surface-container px-3 py-2 text-xs text-on-surface" defaultValue={item.assigned_to ?? ""}>
                      <option value="">Asignar responsable</option>
                      {staff.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.full_name || member.email} · {member.role}
                        </option>
                      ))}
                    </select>
                    <button className="rounded border border-primary px-3 py-2 text-xs font-semibold text-primary">
                      Asignar
                    </button>
                  </form>
                  ) : null}
                  {(canResolveIncident || directTutorStudentIds.has(item.reported_by)) ? (
                  <div className="space-y-2">
                    {canResolveIncident ? (
                    <form action={updateIncidentStatus}>
                      <input type="hidden" name="id" value={item.id} />
                      <button name="status" value="en_proceso" className="rounded border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant">
                        En proceso
                      </button>
                    </form>
                    ) : null}
                    <form action={updateIncidentStatus} className="flex flex-col gap-2">
                      <input type="hidden" name="id" value={item.id} />
                      <textarea
                        name="resolution_summary"
                        required
                        minLength={15}
                        rows={3}
                        placeholder="Resumen de resolucion requerido para resolver o cerrar"
                        className="rounded border border-outline-variant bg-surface-container px-3 py-2 text-xs text-on-surface"
                      />
                      <div className="flex flex-wrap gap-2">
                        {canResolveIncident ? (
                        <button name="status" value="resuelta" className="rounded border border-primary px-3 py-2 text-xs font-semibold text-primary">
                          Resolver
                        </button>
                        ) : null}
                        <button name="status" value="cerrada" className="rounded border border-outline px-3 py-2 text-xs font-semibold text-on-surface-variant">
                          Cerrar
                        </button>
                      </div>
                    </form>
                  </div>
                  ) : null}
                  </div>
                ) : isFinalStatus ? <div className="mt-4 flex items-center gap-2 rounded border border-tertiary/40 bg-tertiary-container p-3 text-sm font-semibold text-on-tertiary-container"><span className="material-symbols-outlined text-[18px]">task_alt</span>Caso {item.status === "cerrada" ? "cerrado" : "resuelto"}. No hay acciones operativas pendientes.</div> : null}
                {incidentComments.length > 0 ? (
                  <div className="mt-4 space-y-2 rounded border border-outline-variant bg-surface-container p-3">
                    <p className="text-xs font-semibold uppercase text-on-surface-variant">Seguimiento</p>
                    {incidentComments.map((comment) => (
                      <div key={comment.id} className="border-t border-outline-variant pt-2 first:border-t-0 first:pt-0">
                        <p className="text-sm text-on-surface-variant">{comment.comment}</p>
                        <p className="mt-1 text-[11px] text-on-surface-variant">
                          {comment.author?.full_name ?? comment.author?.email ?? "Usuario visible por RLS"}
                          {comment.created_at ? ` | ${new Date(comment.created_at).toLocaleString("es-MX")}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {!isFinalStatus && (canCommentIncident || item.reported_by === profile.id) ? (
                <form action={createIncidentComment} className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="incident_id" value={item.id} />
                  <input
                    name="comment"
                    required
                    placeholder="Agregar comentario de seguimiento"
                    className="min-w-0 flex-1 rounded border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface"
                  />
                  <button className="rounded border border-primary px-3 py-2 text-xs font-semibold text-primary">
                    Comentar
                  </button>
                </form>
                ) : null}
                {incidentAudit.length > 0 ? (
                  <details className="mt-4 rounded border border-outline-variant bg-surface-container p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase text-on-surface-variant">
                      Bitácora ({incidentAudit.length})
                    </summary>
                    <div className="mt-3 space-y-2">
                      {incidentAudit.map((event) => (
                        <div key={event.id} className="border-t border-outline-variant pt-2 first:border-t-0 first:pt-0">
                          <p className="text-xs text-on-surface-variant">
                            {event.event_type}
                            {event.from_status && event.to_status ? ` · ${statusLabels[event.from_status]} -> ${statusLabels[event.to_status]}` : ""}
                            {event.assignee ? ` · asignado a ${event.assignee.full_name ?? event.assignee.email}` : ""}
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
