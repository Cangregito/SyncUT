import { createSupabaseBrowserClient } from "@plataforma/sdk/client";

import type { ActivityItem, LiveExecutiveData } from "./types";

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
  if (tableName.includes("audit")) {
    return "Incidencias";
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
  const hasEnv =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!hasEnv) {
    return {
      activity: fallbackActivity,
      profileCount: 0,
      auditCount: 0,
      hasLiveSource: false,
    };
  }

  try {
    const supabase = createSupabaseBrowserClient();

    const [profileRes, auditRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name", { count: "exact" }).limit(300),
      supabase
        .from("audit_logs")
        .select("user_id, action, table_name, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (auditRes.error || profileRes.error) {
      return {
        activity: fallbackActivity,
        profileCount: 0,
        auditCount: 0,
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

    return {
      activity: mapped.length > 0 ? mapped : fallbackActivity,
      profileCount: profileRes.count ?? 0,
      auditCount: auditRes.count ?? 0,
      hasLiveSource: true,
    };
  } catch {
    return {
      activity: fallbackActivity,
      profileCount: 0,
      auditCount: 0,
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
