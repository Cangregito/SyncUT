import Link from "next/link";

import { requireProfile } from "@/lib/auth/session";
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
}: {
  label: string;
  value: number;
  icon: string;
  detail: string;
  href: string;
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
      </div>
    </Link>
  );
}

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
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("is_read", false),
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

  const setupErrors = [
    upcomingAppointments.error ? "La tabla de citas aun no esta disponible en la base aplicada." : null,
  ].filter(Boolean);

  const modules = [
    {
      href: "/citas",
      icon: "calendar_month",
      title: "Citas con Tutor",
      text: "Solicitudes, agenda y seguimiento de sesiones de tutoria.",
    },
    {
      href: "/justificaciones",
      icon: "gavel",
      title: "Justificaciones",
      text: "Tramites de faltas con periodo, categoria, estatus y revision.",
    },
    {
      href: "/notificaciones",
      icon: "notifications",
      title: "Notificaciones",
      text: "Bandeja in-app basada en eventos reales del sistema.",
    },
    {
      href: "/incidencias",
      icon: "rule",
      title: "Incidencias",
      text: "Reportes operativos con prioridad, estado y seguimiento.",
    },
  ];

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight mb-1">
          Panel de Control
        </h2>
        <p className="text-sm text-on-surface-variant">
          Datos reales visibles para {profile.email}.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Estudiantes" value={students.count} icon="group" detail="Registros visibles por RLS" href="/dashboard" />
        <KpiCard label="Docentes" value={teachers.count} icon="school" detail="Registros visibles por RLS" href="/dashboard" />
        <KpiCard label="Justificaciones pendientes" value={pendingJustifications.count} icon="gavel" detail="Solicitudes por revisar" href="/justificaciones" />
        <KpiCard label="Proximas citas" value={upcomingAppointments.count} icon="event" detail="Pendientes o confirmadas" href="/citas" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 flex flex-col gap-4">
          <h3 className="text-sm font-headline font-semibold text-on-surface-variant uppercase">
            Modulos de tutorias
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
                  <h4 className="font-medium text-on-surface mb-1">{item.title}</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{item.text}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-headline font-semibold text-on-surface-variant uppercase">
            Atencion operativa
          </h3>
          <div className="bg-surface-container border border-outline-variant rounded-lg p-5 space-y-4">
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
