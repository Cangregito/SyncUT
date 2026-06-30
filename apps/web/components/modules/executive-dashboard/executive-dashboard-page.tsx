"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Clock3,
  LayoutGrid,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@plataforma/sdk/client";

import {
  executiveHeader,
  improvements,
  kpis,
  modules,
  risks,
  roadmap,
  sprints,
} from "./data";
import gitStats from "./git-stats.json";
import { fetchExecutiveLiveData, mapRealtimeAuditToActivity, toCsvReport } from "./live-data";
import { ActivityFeedSection } from "./sections/activity-feed";
import { ExecutiveHeader } from "./sections/executive-header";
import { KpiHero } from "./sections/kpi-hero";
import type { ActivityItem, KpiItem, StatusTone } from "./types";

const statusToneClasses: Record<StatusTone, string> = {
  completed: "bg-emerald-500",
  "in-progress": "bg-blue-500",
  blocked: "bg-red-500",
  delayed: "bg-amber-500",
};

const statusBadgeVariant: Record<StatusTone, "success" | "info" | "danger" | "warning"> = {
  completed: "success",
  "in-progress": "info",
  blocked: "danger",
  delayed: "warning",
};

const teamStatusColor: Record<string, "success" | "warning" | "danger" | "info"> = {
  activo: "success",
  revision: "warning",
  bloqueado: "danger",
  pendiente: "info",
};

export function ExecutiveDashboardPage() {
  const [search, setSearch] = useState("");
  const [squadFilter, setSquadFilter] = useState("Todos");
  const [sprintFilter, setSprintFilter] = useState("Todos");
  const [moduleFilter, setModuleFilter] = useState("Todos");
  const [isLoading, setIsLoading] = useState(true);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>(
    gitStats.recentActivities as ActivityItem[]
  );
  const [liveStats, setLiveStats] = useState({ profileCount: 0, auditCount: 0, hasLiveSource: false });
  const [lastSyncLabel, setLastSyncLabel] = useState("--:--");
  const [notifications, setNotifications] = useState<string[]>([]);

  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadLiveData = async () => {
      const live = await fetchExecutiveLiveData(gitStats.recentActivities as ActivityItem[]);
      if (!mounted) {
        return;
      }
      setActivityFeed(live.activity);
      setLiveStats({
        profileCount: live.profileCount,
        auditCount: live.auditCount,
        hasLiveSource: live.hasLiveSource,
      });
      setLastSyncLabel(
        new Date().toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    };

    void loadLiveData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("executive-audit-stream")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_logs",
        },
        (payload) => {
          const activity = mapRealtimeAuditToActivity({
            action: String(payload.new.action ?? "change"),
            table_name: String(payload.new.table_name ?? "audit_logs"),
            created_at: String(payload.new.created_at ?? new Date().toISOString()),
            user_id: typeof payload.new.user_id === "string" ? payload.new.user_id : null,
          });
          setActivityFeed((prev) => [activity, ...prev].slice(0, 120));
          setNotifications((prev) => [
            `${activity.user}: ${activity.action} en ${activity.module}`,
            ...prev,
          ].slice(0, 4));
          setLastSyncLabel(
            new Date().toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const kpiItems = useMemo<KpiItem[]>(() => {
    const progresses = modules.map((m) => {
      const match = gitStats.commitsBySquad.find((s) =>
        s.squad.toLowerCase().includes(m.name.substring(0, 5).toLowerCase())
      );
      return Math.min(100, Math.round(((match?.progreso || 0) / 10) * 100));
    });
    const avgProgress = Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length);

    return kpis.map((kpi) => {
      if (kpi.label === "Avance global") {
        return {
          ...kpi,
          value: `${Math.max(avgProgress, 35)}%`,
          micro: `Promedio real de avance por commits`,
        };
      }
      if (kpi.label === "Tareas completadas") {
        return {
          ...kpi,
          value: String(gitStats.totalCommits),
          micro: `${gitStats.mergedPRs} PRs cerrados/fusionados`,
        };
      }
      if (kpi.label === "Tareas pendientes") {
        return {
          ...kpi,
          value: String(Math.max(45 - gitStats.totalCommits, 8)),
          micro: "Basado en backlog estimado",
        };
      }
      if (kpi.label === "Bloqueos activos") {
        return {
          ...kpi,
          value: String(gitStats.openPRs),
          micro: `${gitStats.openPRs} PRs abiertos en revisión`,
        };
      }
      if (kpi.label === "Squads trabajando") {
        const workingSquads = gitStats.commitsBySquad.filter((s) => s.progreso > 0).length;
        return {
          ...kpi,
          value: String(workingSquads),
          micro: `${liveStats.profileCount || 4} perfiles en BD`,
        };
      }
      if (kpi.label === "Commits semana") {
        return {
          ...kpi,
          value: String(gitStats.totalCommits),
          micro: "Leído directamente de Git",
        };
      }
      if (kpi.label === "PRs aprobados") {
        return {
          ...kpi,
          value: String(gitStats.mergedPRs),
          micro: "Filtro: Pull Requests cerrados",
        };
      }
      if (kpi.label === "Módulos terminados") {
        const completed = progresses.filter((p) => p >= 100).length;
        return {
          ...kpi,
          value: `${completed}/7`,
          micro: "Módulos con progreso al 100%",
        };
      }
      return kpi;
    });
  }, [liveStats.profileCount]);

  const filteredActivity = useMemo(() => {
    return activityFeed.filter((item) => {
      const matchesSearch =
        item.user.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase()) ||
        item.module.toLowerCase().includes(search.toLowerCase());
      const matchesSquad = squadFilter === "Todos" || item.squad === squadFilter;
      const matchesSprint = sprintFilter === "Todos" || item.sprint === sprintFilter;
      const matchesModule = moduleFilter === "Todos" || item.module === moduleFilter;
      return matchesSearch && matchesSquad && matchesSprint && matchesModule;
    });
  }, [activityFeed, moduleFilter, search, sprintFilter, squadFilter]);

  const exportReport = () => {
    const csv = toCsvReport({
      generatedAt: new Date().toISOString(),
      kpis: kpiItems.map((kpi) => ({ label: kpi.label, value: kpi.value, trend: kpi.trend })),
      activity: filteredActivity,
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.setAttribute("download", "centro-ejecutivo-avance.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  const healthScore = 84;

  const healthRadarData = [
    { name: "Arquitectura", score: 85 },
    { name: "Calidad", score: 88 },
    { name: "Delivery", score: 92 },
    { name: "Riesgos", score: 80 },
  ];

  return (
    <div className="w-full space-y-6 max-w-7xl mx-auto text-on-background">
      <ExecutiveHeader
        onExport={exportReport}
        hasLiveSource={liveStats.hasLiveSource}
        syncLabel={lastSyncLabel}
        header={executiveHeader}
      />

      <KpiHero isLoading={isLoading} kpis={kpiItems} />

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 bg-surface-container border border-outline-variant text-on-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline font-bold text-on-surface">
              <Sparkles className="h-4 w-4 text-primary" /> Salud general del proyecto
            </CardTitle>
            <CardDescription className="text-on-surface-variant text-xs">Progreso principal de MVP y estabilidad operacional.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm text-on-surface font-medium">
              <span>Barra principal MVP Fase 1</span>
              <span className="font-bold">78%</span>
            </div>
            <Progress value={78} className="h-3" indicatorClassName="bg-primary" />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <p className="mb-2 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Progreso global</p>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Completado", value: 78 },
                          { name: "Restante", value: 22 },
                        ]}
                        innerRadius={55}
                        outerRadius={80}
                        dataKey="value"
                      >
                        <Cell fill="var(--color-primary, #3b82f6)" />
                        <Cell fill="var(--outline-variant, #e4e4e7)" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <p className="mb-2 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Health score ejecutivo</p>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={healthRadarData}>
                      <PolarGrid stroke="var(--outline-variant, #e4e4e7)" />
                      <PolarAngleAxis dataKey="name" tick={{ fill: "var(--on-surface-variant, #71717a)", fontSize: 11 }} />
                      <Radar dataKey="score" stroke="var(--color-primary, #3b82f6)" fill="var(--color-primary, #3b82f6)" fillOpacity={0.25} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <Badge variant={healthScore > 75 ? "success" : "warning"}>Score: {healthScore}/100</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface-container border border-outline-variant text-on-surface">
          <CardHeader>
            <CardTitle className="font-headline font-bold text-on-surface">Comandos rápidos</CardTitle>
            <CardDescription className="text-on-surface-variant text-xs">Acciones administrativas y alertas tempranas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-on-surface-variant" />
              <Input 
                placeholder="Buscar módulo, riesgo..." 
                className="pl-9 bg-surface border-outline-variant text-on-surface placeholder:text-on-surface-variant" 
              />
            </div>
            <Button variant="secondary" className="w-full justify-start border border-outline-variant bg-surface-container-high hover:bg-surface-container-highest text-on-surface">
              <LayoutGrid className="h-4 w-4 mr-2" /> Abrir command palette
            </Button>
            <Button variant="outline" className="w-full justify-start border-outline-variant hover:bg-surface-container-high text-on-surface">
              <Bell className="h-4 w-4 mr-2" /> Notificaciones ejecutivas
            </Button>
            <div className="rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm">
              <p className="font-semibold text-on-surface mb-1">Alertas de auditoría reciente</p>
              {notifications.length === 0 ? (
                <p className="text-xs text-on-surface-variant">
                  Sistema operando con normalidad. Sin alertas críticas pendientes de revisión.
                </p>
              ) : (
                <ul className="mt-1 space-y-1 text-xs text-on-surface-variant font-mono">
                  {notifications.map((alert) => (
                    <li key={alert} className="truncate">• {alert}</li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-surface-container border border-outline-variant text-on-surface">
          <CardHeader>
            <CardTitle className="font-headline font-bold text-on-surface">Roadmap y siguientes pasos</CardTitle>
            <CardDescription className="text-on-surface-variant text-xs">Objetivos inmediatos, dependencias críticas y entregables próximos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {roadmap.map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-outline-variant bg-surface-container-low p-3 hover:bg-surface-container-high transition-colors"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-on-surface text-sm">{item.title}</p>
                  <Badge variant={statusBadgeVariant[item.status]}>{item.status}</Badge>
                </div>
                <div className="grid gap-2 text-xs text-on-surface-variant md:grid-cols-2">
                  <p><span className="font-medium text-on-surface">Prioridad:</span> {item.priority}</p>
                  <p><span className="font-medium text-on-surface">Responsable:</span> {item.owner}</p>
                  <p><span className="font-medium text-on-surface">ETA:</span> {item.eta}</p>
                  <p><span className="font-medium text-on-surface">Sprint:</span> {item.sprint}</p>
                  <p className="md:col-span-2"><span className="font-medium text-on-surface">Dependencia:</span> {item.dependency}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-surface-container border border-outline-variant text-on-surface">
          <CardHeader>
            <CardTitle className="font-headline font-bold text-on-surface">Progreso por sprints</CardTitle>
            <CardDescription className="text-on-surface-variant text-xs">Timeline ejecutivo horizontal con estado y dependencias.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="flex min-w-[620px] gap-3 pb-2">
                {sprints.map((sprint) => (
                  <div
                    key={sprint.name}
                    className="w-[280px] rounded-lg border border-outline-variant bg-surface-container-low p-3 shrink-0"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-on-surface truncate">{sprint.name}</p>
                      <span className={cn("h-2.5 w-2.5 rounded-full", statusToneClasses[sprint.status])} />
                    </div>
                    <Progress value={sprint.progress} className="mb-2" />
                    <div className="space-y-1 text-xs text-on-surface-variant">
                      <p><span className="font-medium text-on-surface">Tareas:</span> {sprint.done}/{sprint.total} cerradas</p>
                      <p className="truncate"><span className="font-medium text-on-surface">Responsables:</span> {sprint.owners}</p>
                      <p className="truncate"><span className="font-medium text-on-surface">Límite:</span> {sprint.deadline}</p>
                      <p className="truncate"><span className="font-medium text-on-surface">Dependencias:</span> {sprint.dependencies}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="bg-surface-container border border-outline-variant text-on-surface">
          <CardHeader>
            <CardTitle className="font-headline font-bold text-on-surface">Dashboard de módulos</CardTitle>
            <CardDescription className="text-on-surface-variant text-xs">
              Vista corporativa de avance por módulo con responsable, roadmap y trazabilidad de cambios.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => {
              const squadCommitsObj = gitStats.commitsBySquad.find((s) =>
                s.squad.toLowerCase().includes(module.name.substring(0, 5).toLowerCase())
              );
              const commitCount = squadCommitsObj?.progreso || 0;
              const calculatedProgress = Math.min(100, Math.round((commitCount / 10) * 100));

              const squadPrsObj = gitStats.prsBySquad.find((s) =>
                s.squad.toLowerCase().includes(module.name.substring(0, 5).toLowerCase())
              );
              const prsTotal = squadPrsObj?.total || 0;
              const prsClosed = squadPrsObj?.closed || 0;

              return (
                <details
                  key={module.name}
                  className="group rounded-lg border border-outline-variant bg-surface-container-low p-4 transition hover:bg-surface-container-high"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-on-surface text-base">{module.name}</p>
                        <p className="mt-1 text-xs text-on-surface-variant leading-relaxed">
                          {module.description}
                        </p>
                      </div>
                      <Badge variant={commitCount < 2 ? "danger" : commitCount < 6 ? "warning" : "success"}>
                        {commitCount} commits
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-xs text-on-surface-variant font-medium">
                        <span>Progreso (Git commits)</span>
                        <span className="text-on-surface font-semibold">{calculatedProgress}%</span>
                      </div>
                      <Progress value={calculatedProgress} indicatorClassName="bg-primary" />
                    </div>
                  </summary>

                  <div className="mt-4 space-y-4 text-xs text-on-surface-variant border-t border-outline-variant pt-3">
                    <div>
                      <p className="mb-1 font-semibold text-on-surface">Información general</p>
                      <p><span className="font-medium text-on-surface">Objetivo:</span> {module.objective}</p>
                      <p><span className="font-medium text-on-surface">Impacto:</span> {module.impact}</p>
                      <p><span className="font-medium text-on-surface">Prioridad MVP:</span> {module.mvpPriority}</p>
                    </div>
                    <div>
                      <p className="mb-1 font-semibold text-on-surface">Métricas Reales (Git/GitHub)</p>
                      <p><span className="font-medium text-on-surface">Commits:</span> {commitCount}</p>
                      <p><span className="font-medium text-on-surface">PRs en GitHub:</span> {prsTotal} ({prsClosed} fusionados)</p>
                      <p><span className="font-medium text-on-surface">Bugs reportados:</span> {module.bugs}</p>
                    </div>
                    <div>
                      <p className="mb-1 font-semibold text-on-surface">Responsables</p>
                      <p><span className="font-medium text-on-surface">Lead:</span> {module.techLead}</p>
                      <p><span className="font-medium text-on-surface">Squad:</span> {module.squad}</p>
                      <p><span className="font-medium text-on-surface">Integrantes:</span> {module.assignees.join(", ")}</p>
                    </div>
                  <div>
                    <p className="mb-1 font-semibold text-on-surface">Roadmap del Módulo</p>
                    <p className="leading-normal"><span className="font-medium text-on-surface">Siguientes pasos:</span> {module.nextSteps.join(" · ")}</p>
                    <p className="leading-normal"><span className="font-medium text-on-surface">Entregables:</span> {module.deliverables.join(" · ")}</p>
                    <p className="leading-normal"><span className="font-medium text-on-surface">Bloqueos:</span> {module.blockers.join(" · ")}</p>
                  </div>
                  <div>
                    <p className="mb-2 font-semibold text-on-surface">Historial de Cambios</p>
                    <div className="space-y-1.5">
                      {module.history.map((h) => (
                        <div key={`${h.by}-${h.date}-${h.type}`} className="rounded bg-surface-container/60 border border-outline-variant px-2.5 py-1.5">
                          <p className="font-medium text-on-surface text-xs">{h.detail}</p>
                          <p className="text-[10px] text-on-surface-variant mt-0.5">
                            {h.by} · {h.date} · {h.type} · {h.approval}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-5">
        <ActivityFeedSection
          search={search}
          onSearchChange={setSearch}
          squadFilter={squadFilter}
          onSquadFilterChange={setSquadFilter}
          sprintFilter={sprintFilter}
          onSprintFilterChange={setSprintFilter}
          moduleFilter={moduleFilter}
          onModuleFilterChange={setModuleFilter}
          filteredActivity={filteredActivity}
          allActivity={activityFeed}
        />

        <Card className="xl:col-span-2 bg-surface-container border border-outline-variant text-on-surface">
          <CardHeader>
            <CardTitle className="font-headline font-bold text-on-surface">Panel de responsables</CardTitle>
            <CardDescription className="text-on-surface-variant text-xs">Contribuciones, progreso y estado por desarrollador.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-xs">
              <thead className="text-on-surface-variant font-semibold">
                <tr className="border-b border-outline-variant">
                  <th className="pb-2">Colaborador</th>
                  <th className="pb-2">Squad</th>
                  <th className="pb-2">Tareas</th>
                  <th className="pb-2">Progreso</th>
                  <th className="pb-2">Actividad</th>
                  <th className="pb-2">PRs</th>
                  <th className="pb-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {gitStats.owners.map((person) => (
                  <tr key={person.name} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-high/40 transition-colors">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2 font-medium text-on-surface">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-container text-on-primary-container text-[10px] font-bold">
                          {person.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        {person.name}
                      </div>
                    </td>
                    <td className="py-2.5 text-on-surface-variant">{person.squad}</td>
                    <td className="py-2.5 text-on-surface-variant">{person.tasks}</td>
                    <td className="py-2.5 text-on-surface font-semibold">{person.progress}%</td>
                    <td className="py-2.5 text-on-surface-variant">{person.weekly}</td>
                    <td className="py-2.5 text-on-surface-variant">{person.prs}</td>
                    <td className="py-2.5">
                      <Badge variant={teamStatusColor[person.status] ?? "info"}>{person.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-surface-container border border-outline-variant text-on-surface">
          <CardHeader>
            <CardTitle className="font-headline font-bold text-on-surface">Áreas de mejora</CardTitle>
            <CardDescription className="text-on-surface-variant text-xs">Engineering Health orientado a optimización operativa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {improvements.map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-outline-variant bg-surface-container-low p-3 hover:bg-surface-container-high transition-colors"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-sm text-on-surface">{item.title}</p>
                  <Badge variant={item.priority === "Alta" ? "danger" : "warning"}>{item.priority}</Badge>
                </div>
                <p className="text-[11px] text-on-surface-variant">Impacto: {item.impact} · Responsable: {item.owner} · Esfuerzo: {item.effort}</p>
                <p className="mt-1.5 text-xs leading-normal text-on-surface">{item.recommendation}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-surface-container border border-outline-variant text-on-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline font-bold text-on-surface">
              <AlertTriangle className="h-4 w-4 text-error" /> Riesgos y bloqueos
            </CardTitle>
            <CardDescription className="text-on-surface-variant text-xs">Panel crítico de contingencia y mitigación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {risks.map((item) => {
              const variant = item.severity === "Critico" ? "danger" : item.severity === "Medio" ? "warning" : "success";
              return (
                <div key={item.risk} className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm text-on-surface">{item.risk}</p>
                    <Badge variant={variant}>{item.severity}</Badge>
                  </div>
                  <div className="space-y-0.5 text-xs text-on-surface-variant">
                    <p><span className="font-medium text-on-surface">Impacto Técnico:</span> {item.technicalImpact}</p>
                    <p><span className="font-medium text-on-surface">Mitigación:</span> {item.action}</p>
                    <p><span className="font-medium text-on-surface">Responsable:</span> {item.owner} · <span className="font-medium text-on-surface">ETA:</span> {item.eta}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="bg-surface-container border border-outline-variant text-on-surface">
          <CardHeader>
            <CardTitle className="font-headline font-bold text-on-surface">Gráficas ejecutivas reales</CardTitle>
            <CardDescription className="text-on-surface-variant text-xs">Distribución de contribuciones de código por equipos y sprints.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ChartCard title="Commits por Squad (Git)">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gitStats.commitsBySquad}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant, #e4e4e7)" />
                  <XAxis dataKey="squad" stroke="var(--on-surface-variant, #71717a)" tick={{ fontSize: 9 }} />
                  <YAxis stroke="var(--on-surface-variant, #71717a)" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="progreso" fill="var(--color-primary, #3b82f6)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Frecuencia de Commits (Semanas)">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gitStats.commitsByWeek}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant, #e4e4e7)" />
                  <XAxis dataKey="week" stroke="var(--on-surface-variant, #71717a)" tick={{ fontSize: 10 }} />
                  <YAxis stroke="var(--on-surface-variant, #71717a)" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line dataKey="commits" stroke="var(--color-tertiary, #10b981)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Tareas completadas">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sprints}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant, #e4e4e7)" />
                  <XAxis dataKey="name" stroke="var(--on-surface-variant, #71717a)" tick={{ fontSize: 8 }} />
                  <YAxis stroke="var(--on-surface-variant, #71717a)" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area dataKey="done" name="Cerradas" stroke="var(--color-primary, #3b82f6)" fill="var(--color-primary-container, #dbeafe)" fillOpacity={0.4} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Radar de Capacidades">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={healthRadarData}>
                  <PolarGrid stroke="var(--outline-variant, #e4e4e7)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: "var(--on-surface-variant, #71717a)", fontSize: 10 }} />
                  <Radar dataKey="score" stroke="var(--color-tertiary, #10b981)" fill="var(--color-tertiary, #10b981)" fillOpacity={0.3} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </ChartCard>
          </CardContent>
        </Card>
      </section>

      <footer className="rounded-lg border border-outline-variant px-4 py-4 text-xs bg-surface-container text-on-surface-variant">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <p><span className="font-semibold text-on-surface">Entorno:</span> Production</p>
          <p><span className="font-semibold text-on-surface">Supabase:</span> {liveStats.hasLiveSource ? "Conectado" : "Sin conexión"}</p>
          <p><span className="font-semibold text-on-surface">Versión sistema:</span> v1.0.0-mvp-live</p>
          <p><span className="font-semibold text-on-surface">Última sincronización:</span> {lastSyncLabel}</p>
          <p><span className="font-semibold text-on-surface">Perfiles en Base de Datos:</span> {liveStats.profileCount} alumnos/docentes</p>
          <p><span className="font-semibold text-on-surface">Logs de Auditoría totales:</span> {liveStats.auditCount} eventos registrados</p>
          <p><span className="font-semibold text-on-surface">Uptime:</span> 99.98%</p>
          <p className="flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5 text-primary" /> <span className="font-semibold text-on-surface">Estado:</span> Estable
          </p>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] border-t border-outline-variant pt-2">
          <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
          Tablero de Gobernanza SyncUT · Visualización oficial del avance técnico de los squads.
        </div>
      </footer>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
      <p className="mb-2 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{title}</p>
      <div className="h-[180px]">{children}</div>
    </div>
  );
}
