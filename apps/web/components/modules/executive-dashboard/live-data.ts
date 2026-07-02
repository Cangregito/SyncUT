import { createSupabaseBrowserClient } from "@plataforma/sdk/client";

import type { ActivityItem, LiveExecutiveData, ModuleOperationalMetric } from "./types";

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
    }),
    time: date.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  };
}

function inferModule(tableName: string) {
  if (tableName.includes("profile") || tableName.includes("session")) {
    return "Autenticación";
  }
  if (tableName.includes("appointment") || tableName.includes("availability")) {
    return "Citas";
  }
  if (tableName.includes("justification")) {
    return "Justificaciones";
  }
  if (tableName.includes("notification") || tableName.includes("email")) {
    return "Notificaciones";
  }
  if (tableName.includes("chatbot")) {
    return "Chatbot";
  }
  if (tableName.includes("incident")) {
    return "Incidencias";
  }
  if (tableName.includes("audit")) {
    return "Auditoría";
  }
  return "Dashboard Base";
}

function inferAction(action: string) {
  const normalized = action.toLowerCase();
  if (normalized.includes("merge")) return "merge";
  if (normalized.includes("deploy")) return "deploy";
  if (normalized.includes("test")) return "test";
  if (normalized.includes("fix") || normalized.includes("hot")) return "hotfix";
  if (normalized.includes("approve")) return "approval";
  return "validation";
}

function inferImpact(action: string) {
  const normalized = action.toLowerCase();
  if (normalized.includes("delete") || normalized.includes("critical")) return "Alto";
  if (normalized.includes("update") || normalized.includes("merge")) return "Medio";
  return "Bajo";
}

export function mapRealtimeAuditToActivity(payload: {
  action: string;
  table_name: string;
  created_at: string;
  user_name?: string;
  user_id?: string | null;
}): ActivityItem {
  const stamp = formatDate(payload.created_at);
  const moduleName = inferModule(payload.table_name);
  return {
    user: payload.user_name ?? payload.user_id ?? "Sistema",
    action: inferAction(payload.action),
    description: `Evento ${payload.action} registrado en ${payload.table_name}.`,
    module: moduleName,
    squad:
      moduleName === "Autenticación"
        ? "Squad 4"
        : moduleName === "Incidencias"
          ? "Squad 2"
          : "PMO",
    sprint: "Sprint 3",
    date: stamp.date,
    time: stamp.time,
    status: "Registrado",
    impact: inferImpact(payload.action),
  };
}

export async function fetchExecutiveLiveData(
  fallbackActivity: ActivityItem[]
): Promise<LiveExecutiveData> {
  const emptyMetrics: ModuleOperationalMetric[] = [];
  const hasEnv =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!hasEnv) {
    return {
      activity: fallbackActivity,
      profileCount: 0,
      auditCount: 0,
      operationalProgress: 0,
      openWorkCount: 0,
      attentionCount: 0,
      unreadNotifications: 0,
      overdueIncidents: 0,
      upcomingAppointments: 0,
      pendingJustifications: 0,
      activeConversations: 0,
      openHandoffs: 0,
      pendingEmails: 0,
      moduleMetrics: emptyMetrics,
      hasLiveSource: false,
    };
  }

  try {
    const supabase = createSupabaseBrowserClient();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    const [
      profileRes,
      auditRes,
      appointmentsRes,
      pendingAppointmentsRes,
      upcomingAppointmentsRes,
      justificationsRes,
      pendingJustificationsRes,
      incidentsRes,
      openIncidentsRes,
      overdueIncidentsRes,
      notificationsRes,
      unreadNotificationsRes,
      conversationsRes,
      activeConversationsRes,
      openHandoffsRes,
      pendingEmailsRes,
    ] = await Promise.all([
      supabase.from("profiles").select("id, full_name", { count: "exact" }).limit(300),
      supabase
        .from("audit_logs")
        .select("user_id, action, table_name, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("appointments").select("id", { count: "exact", head: true }),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendiente"),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .gte("scheduled_date", today)
        .in("status", ["pendiente", "confirmada"]),
      supabase.from("justifications").select("id", { count: "exact", head: true }),
      supabase
        .from("justifications")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "requires_more_info"]),
      supabase.from("incidents").select("id", { count: "exact", head: true }),
      supabase
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .in("status", ["abierta", "en_proceso"]),
      supabase
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .in("status", ["abierta", "en_proceso"])
        .lt("sla_due_at", now),
      supabase.from("notifications").select("id", { count: "exact", head: true }),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false),
      supabase.from("chatbot_conversations").select("id", { count: "exact", head: true }),
      supabase
        .from("chatbot_conversations")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "active", "pending"]),
      supabase
        .from("chatbot_handoffs")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "pending", "assigned"]),
      supabase
        .from("email_queue")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "processing", "failed"]),
    ]);

    const responses = [
      profileRes,
      auditRes,
      appointmentsRes,
      justificationsRes,
      incidentsRes,
      notificationsRes,
      conversationsRes,
    ];
    const successfulReads = responses.filter((response) => !response.error).length;

    if (successfulReads === 0) {
      return {
        activity: fallbackActivity,
        profileCount: 0,
        auditCount: 0,
        operationalProgress: 0,
        openWorkCount: 0,
        attentionCount: 0,
        unreadNotifications: 0,
        overdueIncidents: 0,
        upcomingAppointments: 0,
        pendingJustifications: 0,
        activeConversations: 0,
        openHandoffs: 0,
        pendingEmails: 0,
        moduleMetrics: emptyMetrics,
        hasLiveSource: false,
      };
    }

    type ProfileRow = { id: string; full_name: string | null };
    type AuditRow = { user_id: string | null; action: string; table_name: string; created_at: string };

    const profileData = (profileRes.data as ProfileRow[] | null) ?? [];
    const auditData = (auditRes.data as AuditRow[] | null) ?? [];

    const userById = new Map(
      profileData.map((p) => [p.id, p.full_name ?? "Usuario"])
    );

    const mapped = auditData.map((row) =>
      mapRealtimeAuditToActivity({
        action: row.action,
        table_name: row.table_name,
        created_at: row.created_at,
        user_id: row.user_id,
        user_name: row.user_id ? userById.get(row.user_id) : undefined,
      })
    );

    const count = (response: { count: number | null; error: unknown }) =>
      response.error ? 0 : response.count ?? 0;
    const pendingAppointments = count(pendingAppointmentsRes);
    const upcomingAppointments = count(upcomingAppointmentsRes);
    const pendingJustifications = count(pendingJustificationsRes);
    const openIncidents = count(openIncidentsRes);
    const overdueIncidents = count(overdueIncidentsRes);
    const unreadNotifications = count(unreadNotificationsRes);
    const activeConversations = count(activeConversationsRes);
    const openHandoffs = count(openHandoffsRes);
    const pendingEmails = count(pendingEmailsRes);

    const moduleMetrics: ModuleOperationalMetric[] = [
      {
        name: "Citas",
        description: "Citas registradas y próximas sesiones pendientes de atención.",
        href: "/citas",
        total: count(appointmentsRes),
        totalLabel: "citas",
        attention: pendingAppointments,
        statusLabel: pendingAppointments > 0 ? "Pendientes" : "Al dia",
        tone: pendingAppointments > 0 ? "warning" : "success",
      },
      {
        name: "Justificaciones",
        description: "Solicitudes con evidencia y revisión administrativa.",
        href: "/justificaciones",
        total: count(justificationsRes),
        totalLabel: "solicitudes",
        attention: pendingJustifications,
        statusLabel: pendingJustifications > 0 ? "Por revisar" : "Al dia",
        tone: pendingJustifications > 0 ? "warning" : "success",
      },
      {
        name: "Incidencias",
        description: "Reportes abiertos, asignaciones y cumplimiento de SLA.",
        href: "/incidencias",
        total: count(incidentsRes),
        totalLabel: "reportes",
        attention: overdueIncidents || openIncidents,
        statusLabel: overdueIncidents > 0 ? "SLA vencido" : openIncidents > 0 ? "Abiertas" : "Al dia",
        tone: overdueIncidents > 0 || openIncidents > 0 ? "warning" : "success",
      },
      {
        name: "Notificaciones",
        description: "Avisos internos y cola de correos generados por eventos.",
        href: "/notificaciones",
        total: count(notificationsRes),
        totalLabel: "avisos",
        attention: unreadNotifications + pendingEmails,
        statusLabel:
          unreadNotifications + pendingEmails > 0 ? "Pendientes" : "Al dia",
        tone: unreadNotifications + pendingEmails > 0 ? "warning" : "success",
      },
      {
        name: "Chatbot",
        description: "Conversaciones, escalaciones y transferencias a personal.",
        href: "/chatbot",
        total: count(conversationsRes),
        totalLabel: "conversaciones",
        attention: openHandoffs,
        statusLabel: openHandoffs > 0 ? "Escalaciones" : "Al dia",
        tone: openHandoffs > 0 ? "warning" : activeConversations > 0 ? "info" : "success",
      },
    ];
    const healthyModules = moduleMetrics.filter((metric) => metric.tone === "success").length;
    const operationalProgress = Math.round((healthyModules / moduleMetrics.length) * 100);
    const openWorkCount =
      pendingAppointments + pendingJustifications + openIncidents + openHandoffs + pendingEmails;
    const attentionCount =
      pendingAppointments +
      pendingJustifications +
      overdueIncidents +
      unreadNotifications +
      openHandoffs +
      pendingEmails;

    return {
      activity: mapped.length > 0 ? mapped : fallbackActivity,
      profileCount: profileRes.count ?? 0,
      auditCount: auditRes.count ?? 0,
      operationalProgress,
      openWorkCount,
      attentionCount,
      unreadNotifications,
      overdueIncidents,
      upcomingAppointments,
      pendingJustifications,
      activeConversations,
      openHandoffs,
      pendingEmails,
      moduleMetrics,
      hasLiveSource: true,
    };
  } catch {
    return {
      activity: fallbackActivity,
      profileCount: 0,
      auditCount: 0,
      operationalProgress: 0,
      openWorkCount: 0,
      attentionCount: 0,
      unreadNotifications: 0,
      overdueIncidents: 0,
      upcomingAppointments: 0,
      pendingJustifications: 0,
      activeConversations: 0,
      openHandoffs: 0,
      pendingEmails: 0,
      moduleMetrics: emptyMetrics,
      hasLiveSource: false,
    };
  }
}

export function toCsvReport(params: {
  generatedAt: string;
  kpis: Array<{ label: string; value: string; trend: string }>;
  activity: ActivityItem[];
}) {
  const lines: string[] = [];
  lines.push(`"Centro Ejecutivo de Avance"`);
  lines.push(`"Generado","${params.generatedAt}"`);
  lines.push("");
  lines.push('"KPI","Valor","Tendencia"');
  for (const row of params.kpis) {
    lines.push(`"${row.label}","${row.value}","${row.trend}"`);
  }
  lines.push("");
  lines.push('"Usuario","Accion","Descripcion","Modulo","Sprint","Fecha","Hora","Estado","Impacto"');
  for (const item of params.activity) {
    lines.push(
      `"${item.user}","${item.action}","${item.description}","${item.module}","${item.sprint}","${item.date}","${item.time}","${item.status}","${item.impact}"`
    );
  }
  return lines.join("\n");
}
