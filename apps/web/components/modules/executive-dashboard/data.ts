import type { KpiItem, StatusTone } from "./types";

export const executiveHeader = {
  projectName: "Plataforma Universitaria Integral (SyncUT)",
  status: "En desarrollo",
  version: "MVP Beta v1.0.0",
  updatedAt: new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }),
  environment: "Production",
  leader: "Jassiel García",
  leaderRole: "Project Lead / Admin Master",
  // `online` lo decide la lectura real de Supabase en executive-dashboard-page.
};

export const kpis: KpiItem[] = [
  { label: "Avance global", value: "0%", trend: "Supabase", tone: "success", icon: "Gauge", micro: "Promedio del roadmap de módulos" },
  { label: "Commits totales", value: "0", trend: "Git", tone: "success", icon: "CheckCircle2", micro: "Historial de la rama desplegada" },
  { label: "PRs abiertos", value: "0", trend: "GitHub", tone: "info", icon: "ListTodo", micro: "Pull requests pendientes" },
  { label: "Bloqueos activos", value: "0", trend: "Supabase", tone: "warning", icon: "ShieldAlert", micro: "1 de integración externa" },
  { label: "Squads con actividad", value: "6", trend: "Git", tone: "info", icon: "Users", micro: "Squads con commits registrados" },
  { label: "Commits semana", value: "0", trend: "Git", tone: "info", icon: "GitCommitHorizontal", micro: "Consolidación de ramas" },
  { label: "PRs fusionados", value: "0", trend: "GitHub", tone: "success", icon: "GitPullRequestArrow", micro: "Pull requests con merge confirmado" },
  { label: "Módulos terminados", value: "0/0", trend: "Supabase", tone: "info", icon: "PackageCheck", micro: "Autenticación, Justificaciones, Dashboard, Notificaciones" },
];

export const roadmap = [
  {
    title: "Cierre de pruebas de conversión de retardos",
    priority: "Alta",
    owner: "Squad 1 · Justificaciones",
    eta: "12 Jun 2026",
    sprint: "Sprint 3",
    status: "in-progress" as StatusTone,
    dependency: "Estructura de perfiles de usuario",
  },
  {
    title: "Consolidación del motor de envío de correos",
    priority: "Alta",
    owner: "Squad 4 · Notificaciones",
    eta: "14 Jun 2026",
    sprint: "Sprint 3",
    status: "in-progress" as StatusTone,
    dependency: "Tokens de API e integración de Resend",
  },
  {
    title: "Implementación del semáforo de incidencias",
    priority: "Alta",
    owner: "Squad 5 · Incidencias",
    eta: "18 Jun 2026",
    sprint: "Sprint 3",
    status: "in-progress" as StatusTone,
    dependency: "Vistas y filtros de tutoría",
  },
  {
    title: "Hardening de políticas RLS y auditoría",
    priority: "Crítica",
    owner: "Squad 2 · Auditoría",
    eta: "15 Jun 2026",
    sprint: "Sprint 3",
    status: "in-progress" as StatusTone,
    dependency: "Migraciones de DB completadas",
  },
];

export const sprints = [
  {
    name: "Sprint 0 — Configuración inicial",
    progress: 100,
    total: 10,
    done: 10,
    owners: "Jassiel García",
    risks: "Sin riesgos",
    status: "completed" as StatusTone,
    deadline: "18 May 2026",
    dependencies: "Pnpm workspaces configurado",
  },
  {
    name: "Sprint 1 — Autenticación y Modelado",
    progress: 100,
    total: 24,
    done: 24,
    owners: "Squad 2 + Jassiel García",
    risks: "Riesgo bajo",
    status: "completed" as StatusTone,
    deadline: "25 May 2026",
    dependencies: "Esquemas Supabase iniciales",
  },
  {
    name: "Sprint 2 — Justificaciones e Integración",
    progress: 100,
    total: 35,
    done: 35,
    owners: "Squad 1 + Jassiel García",
    risks: "Riesgo medio",
    status: "completed" as StatusTone,
    deadline: "02 Jun 2026",
    dependencies: "Triggers de retardos a faltas",
  },
  {
    name: "Sprint 3 — Citas, Chatbot e Incidencias",
    progress: 68,
    total: 48,
    done: 32,
    owners: "Squads 3, 5, 6",
    risks: "Riesgo alto",
    status: "in-progress" as StatusTone,
    deadline: "16 Jun 2026",
    dependencies: "Webhooks y LDAP institucional",
  },
];

export const improvements = [
  {
    title: "Normalizar criterios de severidad entre squads",
    impact: "Alto",
    priority: "Alta",
    owner: "PMO + QA Guild",
    recommendation: "Adoptar matriz unica de impacto/probabilidad para riesgos y bugs.",
    effort: "2 semanas",
  },
  {
    title: "Reducir deuda tecnica en integraciones externas",
    impact: "Alto",
    priority: "Alta",
    owner: "Arquitectura",
    recommendation: "Agregar capa anti-corruption para APIs institucionales heredadas.",
    effort: "3 semanas",
  },
  {
    title: "Mejorar throughput de revisiones de PR",
    impact: "Medio",
    priority: "Media",
    owner: "Tech Leads",
    recommendation: "Implementar policy de SLA por tamaño de cambio y reviewer backup.",
    effort: "1 semana",
  },
  {
    title: "Instrumentacion de trazabilidad funcional",
    impact: "Medio",
    priority: "Media",
    owner: "Data Team",
    recommendation: "Completar telemetria de embudo para citas y justificaciones.",
    effort: "2 semanas",
  },
] as const;

export const risks = [
  {
    risk: "Dependencia del webhook institucional para recordatorios",
    severity: "Critico",
    technicalImpact: "Bloquea envio programado en citas",
    operationalImpact: "Aumenta ausentismo y reprogramaciones",
    owner: "Squad 3",
    action: "Habilitar fallback SMTP y cola de reintentos",
    eta: "20 May 2026",
  },
  {
    risk: "Aprobacion juridica pendiente para flujo de evidencias",
    severity: "Medio",
    technicalImpact: "Retiene release de justificaciones",
    operationalImpact: "Continuidad parcial en tramite manual",
    owner: "Squad 1",
    action: "Mesa legal semanal y feature toggle",
    eta: "23 May 2026",
  },
  {
    risk: "Saturacion temporal en analitica semanal",
    severity: "Estable",
    technicalImpact: "Retraso en consolidacion de KPI",
    operationalImpact: "Reporte ejecutivo con latencia",
    owner: "Data Team",
    action: "Escalado horizontal nocturno",
    eta: "19 May 2026",
  },
] as const;

