import { ExecutiveDashboardPage } from "@/components/modules/executive-dashboard/executive-dashboard-page";
import { requireRole } from "@/lib/auth/session";

export default async function ProjectProgressPage() {
  await requireRole(["admin"]);

  return (
    <main className="mx-auto flex max-w-[1500px] flex-col gap-6 pb-12">
      <section className="rounded-2xl border border-violet-400/15 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,.2),transparent_40%),linear-gradient(135deg,#15131b,#0d0d10)] p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-300">Observatorio del proyecto</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Avance, commits y estado técnico</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">Progreso por módulo, actividad Git/GitHub, Pull Requests, responsables, salud de Supabase y registros históricos del proyecto.</p>
      </section>
      <ExecutiveDashboardPage />
    </main>
  );
}
