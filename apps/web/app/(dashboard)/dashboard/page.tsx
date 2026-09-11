import Link from "next/link";

import { DonutChart } from "@/components/charts/donut-chart";
import { SignalTrend } from "@/components/charts/signal-trend";
import { Sparkline } from "@/components/charts/sparkline";
import { requireProfile } from "@/lib/auth/session";
import {
  getModulesForRole,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type UserRole,
} from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CountResult = {
  count: number;
  error: string | null;
};

async function countFrom(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<CountResult> {
  const { count, error } = await query;
  return { count: count ?? 0, error: error?.message ?? null };
}

function KpiCard({
  label,
  value,
  icon,
  detail,
  href,
  trend,
  trendColor,
}: {
  label: string;
  value: number;
  icon: string;
  detail: string;
  href: string;
  /** Serie corta (por dia) que se dibuja como sparkline bajo el valor. */
  trend?: number[];
  trendColor?: string;
}) {
  return (
    <Link
      href={href}
      className="bg-surface-container border border-outline-variant rounded-lg p-5 flex flex-col justify-between hover:bg-surface-container-high transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <div className="flex justify-between items-start mb-4">
        <span className="text-sm font-medium text-on-surface-variant">{label}</span>
        <span className="material-symbols-outlined text-primary text-xl">{icon}</span>
      </div>
      <div>
        <span className="text-3xl font-headline font-bold text-on-surface tracking-tighter">
          {value.toLocaleString("es-MX")}
        </span>
        <p className="mt-1 text-xs font-medium text-on-surface-variant">{detail}</p>
        {trend ? <Sparkline points={trend} color={trendColor} className="mt-3" height={32} /> : null}
      </div>
    </Link>
  );
}

const workflowByRole: Record<UserRole, { title: string; steps: string[] }> = {
  student: {
    title: "Flujo estudiante",
    steps: [
      "Solicita una cita con su tutor asignado.",
      "Registra justificaciones con evidencia cuando falta.",
      "Consulta notificaciones y da seguimiento a incidencias propias.",
    ],
  },
  teacher: {
    title: "Flujo docente",
    steps: [
      "Aporta contexto de materia y asistencia en justificaciones.",
      "Comenta incidencias academicas asignadas por el tutor responsable.",
      "No aprueba ni asigna casos; deja evidencia para decision institucional.",
    ],
  },
  tutor: {
    title: "Flujo tutor",
    steps: [
      "Publica disponibilidad y confirma citas.",
      "Registra asistencia, acuerdos y seguimiento de tutorias.",
      "Aprueba, rechaza o pide informacion en justificaciones.",
      "Asigna responsables y resuelve incidencias.",
      "Administra contenidos del asistente institucional.",
    ],
  },
  admin: {
    title: "Flujo administrador",
    steps: [
      "Valida salud general de modulos y datos.",
      "Gestiona roles por RPC auditada.",
      "Revisa auditoria, seguridad y metricas ejecutivas.",
    ],
  },
};

export default async function DashboardOverviewPage() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    students,
    teachers,
    pendingJustifications,
    upcomingAppointments,
    unreadNotifications,
    openIncidents,
    activeConversations,
  ] = await Promise.all([
    countFrom(supabase.from("students").select("id", { count: "exact", head: true })),
    countFrom(supabase.from("teachers").select("id", { count: "exact", head: true })),
    countFrom(
      supabase
        .from("justifications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ),
    countFrom(
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .gte("scheduled_date", today)
        .in("status", ["pendiente", "confirmada"]),
    ),
    countFrom(
      (profile.role === "teacher" ? supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("is_read", false)
        .in("event_type", ["tutor.teacher_message", "justification.teacher_delivery"]) : supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("is_read", false)),
    ),
    countFrom(
      supabase
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .in("status", ["abierta", "en_proceso"]),
    ),
    countFrom(
      supabase
        .from("chatbot_conversations")
        .select("id", { count: "exact", head: true })
        .in("status", ["active", "escalated"]),
    ),
  ]);

  // Series para las graficas. Se agregan en servidor sobre lo que RLS deja ver,
  // asi cada rol recibe un panorama de sus propios datos.
  const nowMs = new Date(today).getTime();
  const sevenDaysAgo = new Date(nowMs - 7 * 86_400_000).toISOString();
  const in14Days = new Date(nowMs + 14 * 86_400_000).toISOString().slice(0, 10);
  const [needsInfo, approved, rejected, recentJustifications, upcomingRows] = await Promise.all([
    countFrom(supabase.from("justifications").select("id", { count: "exact", head: true }).eq("status", "requires_more_info")),
    countFrom(supabase.from("justifications").select("id", { count: "exact", head: true }).eq("status", "approved")),
    countFrom(supabase.from("justifications").select("id", { count: "exact", head: true }).eq("status", "rejected")),
    supabase.from("justifications").select("created_at").gte("created_at", sevenDaysAgo).limit(500),
    supabase
      .from("appointments")
      .select("scheduled_date, status")
      .gte("scheduled_date", today)
      .lte("scheduled_date", in14Days)
      .in("status", ["pendiente", "confirmada"])
      .limit(500),
  ]);

  const dayKeys = Array.from({ length: 7 }, (_, index) => new Date(nowMs - (6 - index) * 86_400_000).toISOString().slice(0, 10));
  const justificationTrend = dayKeys.map((day) => (recentJustifications.data ?? []).filter((row) => (row.created_at ?? "").slice(0, 10) === day).length);

  const upcoming = (upcomingRows.data ?? []) as Array<{ scheduled_date: string; status: string }>;
  const nextDays = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(nowMs + index * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    return {
      label: date.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" }),
      confirmadas: upcoming.filter((row) => row.scheduled_date === key && row.status === "confirmada").length,
      pendientes: upcoming.filter((row) => row.scheduled_date === key && row.status === "pendiente").length,
    };
  });
  const appointmentTrend = nextDays.slice(0, 7).map((day) => day.confirmadas + day.pendientes);

  const justificationSlices = [
    { label: "Pendientes", value: pendingJustifications.count, color: "var(--chart-amber)" },
    { label: "En observación", value: needsInfo.count, color: "var(--chart-sky)" },
    { label: "Aprobadas", value: approved.count, color: "var(--tertiary)" },
    { label: "Rechazadas", value: rejected.count, color: "var(--error)" },
  ];

  const setupErrors = [
    upcomingAppointments.error ? "La tabla de citas aun no esta disponible en la base aplicada." : null,
  ].filter(Boolean);

  const modules = getModulesForRole(profile.role).filter((item) => item.href !== "/dashboard");
  const roleWorkflow = workflowByRole[profile.role];
  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight mb-1">
          Panel {ROLE_LABELS[profile.role]}
        </h2>
        <p className="text-sm text-on-surface-variant">
          {ROLE_DESCRIPTIONS[profile.role]}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Estudiantes" value={students.count} icon="group" detail="Registros que puedes consultar" href="/dashboard" />
        <KpiCard label="Docentes" value={teachers.count} icon="school" detail="Registros que puedes consultar" href="/dashboard" />
        <KpiCard label="Justificaciones pendientes" value={pendingJustifications.count} icon="gavel" detail="Solicitudes por revisar · nuevas en 7 días" href="/justificaciones" trend={justificationTrend} trendColor="var(--chart-amber)" />
        <KpiCard label="Proximas citas" value={upcomingAppointments.count} icon="event" detail="Pendientes o confirmadas · próximos 7 días" href="/citas" trend={appointmentTrend} trendColor="var(--primary)" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.5fr]">
        <section className="min-w-0 bg-surface-container border border-outline-variant rounded-lg p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Trámites</p>
          <h3 className="text-sm font-bold text-on-surface">Justificaciones por estado</h3>
          <div className="mt-4">
            <DonutChart slices={justificationSlices} centerLabel="en total" size={140} emptyLabel="Aún no hay justificaciones visibles para tu rol." />
          </div>
        </section>
        <section className="min-w-0 bg-surface-container border border-outline-variant rounded-lg p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Agenda</p>
              <h3 className="text-sm font-bold text-on-surface">Citas de los próximos 14 días</h3>
            </div>
            <ul className="flex gap-3 text-[11px] text-on-surface-variant">
              <li className="flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ backgroundColor: "var(--primary)" }} aria-hidden />Confirmadas</li>
              <li className="flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ backgroundColor: "var(--chart-amber)" }} aria-hidden />Pendientes</li>
            </ul>
          </div>
          <div className="mt-3">
            <SignalTrend
              data={nextDays}
              height={190}
              emptyLabel="No hay citas programadas en los próximos 14 días."
              series={[
                { key: "confirmadas", label: "Confirmadas", color: "var(--primary)" },
                { key: "pendientes", label: "Pendientes", color: "var(--chart-amber)" },
              ]}
            />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 flex flex-col gap-4">
          <h3 className="text-sm font-headline font-semibold text-on-surface-variant uppercase">
            Modulos habilitados
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {modules.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col items-start gap-4 hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center group-hover:bg-primary-container transition-colors">
                  <span className="material-symbols-outlined text-primary group-hover:text-on-primary-container">
                    {item.icon}
                  </span>
                </div>
                <div>
                  <h4 className="font-medium text-on-surface mb-1">{item.label}</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {item.squad ? `${item.squad} · Disponible para tu rol` : "Disponible para tu rol"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-headline font-semibold text-on-surface-variant uppercase">
            Trabajo del rol
          </h3>
          <div className="bg-surface-container border border-outline-variant rounded-lg p-5 space-y-4">
            <div>
              <p className="text-sm font-medium text-on-surface">{roleWorkflow.title}</p>
              <ol className="mt-3 space-y-2">
                {roleWorkflow.steps.map((step, index) => (
                  <li key={step} className="flex gap-3 text-xs text-on-surface-variant leading-relaxed">
                    <span className="w-5 h-5 rounded bg-primary-container text-on-primary-container flex items-center justify-center text-[10px] font-bold shrink-0">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-[20px]">notifications</span>
              <div>
                <p className="text-sm font-medium text-on-surface">Notificaciones no leidas</p>
                <p className="text-xs text-on-surface-variant">{unreadNotifications.count} pendientes para tu usuario.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-error text-[20px]">priority_high</span>
              <div>
                <p className="text-sm font-medium text-on-surface">Incidencias activas</p>
                <p className="text-xs text-on-surface-variant">{openIncidents.count} abiertas o en proceso.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-[20px]">chat</span>
              <div>
                <p className="text-sm font-medium text-on-surface">Conversaciones activas</p>
                <p className="text-xs text-on-surface-variant">{activeConversations.count} activas o escaladas.</p>
              </div>
            </div>
            {setupErrors.length > 0 ? (
              <div className="rounded border border-error/40 bg-error-container/20 p-3 text-xs text-on-error-container">
                {setupErrors.join(" ")}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
