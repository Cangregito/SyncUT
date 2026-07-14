import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(
  repositoryRoot,
  "apps/web/components/modules/executive-dashboard/git-stats.json"
);
const githubHeaders = {
  Accept: "application/vnd.github+json",
  "User-Agent": "SyncUT-App",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

const MODULE_EVIDENCE = {
  "Squad 1": {
    name: "Justificaciones",
    squadLabel: "Squad 1",
    href: "/justificaciones",
    description:
      "Gestiona solicitudes de faltas con folio, evidencia, vencimiento, revision administrativa y auditoria.",
    evidence:
      "El modulo demuestra trabajo en tramites academicos, carga de evidencias, bitacora y notificaciones de estado.",
  },
  "Squad 2": {
    name: "Autenticación",
    squadLabel: "Squad 2",
    href: "/login",
    description:
      "Controla acceso, registro, recuperacion de contrasena, perfiles y proteccion de rutas por rol.",
    evidence:
      "El modulo acredita apoyo en identidad, acceso seguro, flujos de login/signup y recuperacion con Supabase Auth.",
  },
  "Squad 3": {
    name: "Citas",
    squadLabel: "Squad 3",
    href: "/citas",
    description:
      "Administra agenda de tutorias, disponibilidad, estados de cita, asistencia/no-show y seguimiento.",
    evidence:
      "El modulo evidencia trabajo en flujo de tutorias, disponibilidad real, auditoria de cambios y notas posteriores.",
  },
  "Squad 4": {
    name: "Notificaciones",
    squadLabel: "Squad 4",
    href: "/notificaciones",
    description:
      "Opera bandeja in-app, preferencias, bitacora, cola de correo y emision de eventos entre modulos.",
    evidence:
      "El modulo respalda comunicacion del sistema con logs, preferencias y cola procesable por Edge Function.",
  },
  "Squad 5": {
    name: "Incidencias",
    squadLabel: "Squad 5",
    href: "/incidencias",
    description:
      "Registra reportes, prioridades, categorias, SLA, asignaciones, comentarios y cierre con resumen.",
    evidence:
      "El modulo evidencia atencion operativa, trazabilidad de reportes, cumplimiento SLA y seguimiento por staff.",
  },
  "Squad 6": {
    name: "Chatbot",
    squadLabel: "Squad 6",
    href: "/chatbot",
    description:
      "Mantiene conversaciones, FAQ oficial, mensajes, feedback y escalaciones humanas con notificacion.",
    evidence:
      "El modulo acredita apoyo en autoservicio, base de conocimiento, conversaciones persistentes y handoffs.",
  },
  "Admin Master": {
    name: "Gobernanza",
    squadLabel: "Admin",
    href: "/admin",
    description:
      "Consolida datos de Git/GitHub, Supabase, auditoria, despliegues y estado ejecutivo de la plataforma.",
    evidence:
      "El modulo muestra evidencia de coordinacion, integracion de PRs, produccion y seguimiento del avance general.",
  },
};

// Mapeo real de correos/nombres de git a integrantes y squads reales
const MEMBER_MAPPING = [
  {
    gitEmails: ["jassiel.rr1502@gmail.com", "86444892+cangregito@users.noreply.github.com"],
    gitNames: ["cangregito jassiel", "cangregito", "jassiel armando garcia reyes"],
    githubUsernames: ["cangregito"],
    realName: "Jassiel García",
    squad: "Admin Master",
    role: "Project Lead",
  },
  {
    gitEmails: ["158553913+panadero414@users.noreply.github.com", "joelchaparro@example.com"],
    gitNames: ["joel alejandro chaparro gonzalez", "panadero414", "joel"],
    githubUsernames: ["panadero414"],
    realName: "Joel Chaparro",
    squad: "Squad 1",
    role: "Tech Lead Justificaciones",
  },
  {
    gitEmails: ["magdas@eplogistics.com"],
    gitNames: ["magdaep", "magdalena"],
    githubUsernames: ["magdaep"],
    realName: "Magdalena Silva",
    squad: "Squad 1",
    role: "QA Engineer Justificaciones",
  },
  {
    gitEmails: ["angelzatarain25@gmail.com"],
    gitNames: ["anzlyzer", "angel zatarain"],
    githubUsernames: ["anzlyzer"],
    realName: "Ángel Zataráin",
    squad: "Squad 2",
    role: "Tech Lead Auditoría",
  },
  {
    gitEmails: [],
    gitNames: ["langostin"],
    githubUsernames: ["langostin"],
    realName: "Langostin",
    squad: "Squad 2",
    role: "Developer Autenticación",
  },
  {
    gitEmails: ["osmaraarau0550@gmail.com"],
    gitNames: ["osmi29", "osmara araujo"],
    githubUsernames: ["osmi29"],
    realName: "Osmara Araujo",
    squad: "Squad 5",
    role: "Tech Lead Incidencias",
  },
  {
    gitEmails: ["ivan.vivd@gmail.com"],
    gitNames: ["ivanvivd", "ivan"],
    githubUsernames: ["ivanvivd"],
    realName: "Iván Vivanco",
    squad: "Squad 4",
    role: "Tech Lead Notificaciones",
  },
  {
    gitEmails: [],
    gitNames: ["ponkis"],
    githubUsernames: ["ponkis"],
    realName: "Ponkis",
    squad: "Squad 4",
    role: "Developer Notificaciones",
  },
  {
    gitEmails: ["edugarmend@gmail.com"],
    gitNames: ["eduardogarciamendoza", "lalog1", "eduardo garcia mendoza"],
    githubUsernames: ["lalog1", "eduardogarciamendoza"],
    realName: "Eduardo García",
    squad: "Squad 3",
    role: "Tech Lead Citas",
  },
  {
    gitEmails: [],
    gitNames: ["alexisz666"],
    githubUsernames: ["alexisz666"],
    realName: "Alexis",
    squad: "Squad 6",
    role: "Developer Chatbot",
  },
  {
    gitEmails: [],
    gitNames: ["reymarroquin"],
    githubUsernames: ["reymarroquin"],
    realName: "Rey Marroquin",
    squad: "Squad 6",
    role: "Developer Chatbot",
  },
  {
    gitEmails: [],
    gitNames: ["karlaclp"],
    githubUsernames: ["karlaclp"],
    realName: "Karla",
    squad: "Squad 1",
    role: "Developer Justificaciones",
  },
  {
    gitEmails: [],
    gitNames: ["marvin61-loviu"],
    githubUsernames: ["marvin61-loviu"],
    realName: "Marvin",
    squad: "Squad 5",
    role: "Developer Incidencias",
  },
  {
    gitEmails: [],
    gitNames: ["eytsugey"],
    githubUsernames: ["eytsugey"],
    realName: "Eytsugey",
    squad: "Squad 5",
    role: "Developer Incidencias",
  },
];

function identifyContributor(name, email) {
  const normName = (name || "").toLowerCase().trim();
  const normEmail = (email || "").toLowerCase().trim();

  for (const m of MEMBER_MAPPING) {
    if (m.gitEmails.includes(normEmail)) return m;
  }
  for (const m of MEMBER_MAPPING) {
    if (m.gitNames.includes(normName)) return m;
  }

  return {
    realName: name || "Colaborador",
    squad: "Externo",
    role: "Desarrollador",
  };
}

function getSquadFromRefOrAuthor(ref, author) {
  const normRef = (ref || "").toLowerCase();
  const normAuthor = (author || "").toLowerCase();

  if (normRef.includes("squad-1") || normRef.includes("justification") || normRef.includes("justificaciones") || normAuthor === "panadero414" || normAuthor === "magdaep" || normAuthor === "karlaclp") {
    return "Squad 1";
  }
  if (normRef.includes("squad-2") || normRef.includes("auth") || normRef.includes("autentic") || normAuthor === "anzlyzer" || normAuthor === "langostin") {
    return "Squad 2";
  }
  if (normRef.includes("squad-3") || normRef.includes("appointment") || normRef.includes("cita") || normAuthor === "lalog1") {
    return "Squad 3";
  }
  if (normRef.includes("squad-4") || normRef.includes("notification") || normRef.includes("notific") || normAuthor === "ivanvivd" || normAuthor === "ponkis") {
    return "Squad 4";
  }
  if (normRef.includes("squad-5") || normRef.includes("incident") || normRef.includes("inciden") || normAuthor === "osmi29" || normAuthor === "marvin61-loviu" || normAuthor === "eytsugey") {
    return "Squad 5";
  }
  if (normRef.includes("squad-6") || normRef.includes("chatbot") || normAuthor === "alexisz666" || normAuthor === "reymarroquin") {
    return "Squad 6";
  }
  return "Admin Master";
}

function getSquadFromPullRequest(pr) {
  const searchableRef = [
    pr.head?.ref,
    pr.head?.label,
    pr.base?.ref,
    pr.base?.label,
    pr.title,
  ]
    .filter(Boolean)
    .join(" ");

  return getSquadFromRefOrAuthor(searchableRef, pr.user?.login);
}

function formatDateTimeForEvidence(date) {
  if (!date || Number.isNaN(date.getTime())) {
    return { date: "Sin fecha", time: "--:--", iso: null };
  }

  return {
    date: date.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    iso: date.toISOString(),
  };
}

function getPullRequestNumberFromSubject(subject) {
  const match = String(subject || "").match(/pull request #(\d+)/i);
  return match ? Number(match[1]) : null;
}

function getSquadFromCommit(commit, pullsByNumber) {
  const prNumber = getPullRequestNumberFromSubject(commit.subject);
  if (prNumber && pullsByNumber.has(prNumber)) {
    return getSquadFromPullRequest(pullsByNumber.get(prNumber));
  }

  const subjectSquad = getSquadFromRefOrAuthor(commit.subject, "");
  if (subjectSquad !== "Admin Master") {
    return subjectSquad;
  }

  return identifyContributor(commit.name, commit.email).squad;
}

function getLocalGitData() {
  try {
    const rawLog = execSync(
      'git log HEAD --pretty=format:"%an|%ae|%ad|%s" --date=iso-strict',
      {
        cwd: repositoryRoot,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024 * 10,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    const headCommit = execSync("git rev-parse HEAD", {
      cwd: repositoryRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();

    const commits = rawLog
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, email, dateStr, ...subjectParts] = line.split("|");
        return {
          name,
          email,
          date: new Date(dateStr),
          subject: subjectParts.join("|"),
        };
      });

    return { commits, headCommit };
  } catch {
    return null;
  }
}

async function getGithubCommitData() {
  const commits = [];
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;

  for (let page = 1; page <= 10; page++) {
    const params = new URLSearchParams({
      per_page: "100",
      page: String(page),
      ...(sha ? { sha } : {}),
    });
    const response = await fetch(
      `https://api.github.com/repos/Cangregito/SyncUT/commits?${params}`,
      { headers: githubHeaders }
    );
    if (!response.ok) {
      throw new Error(`GitHub commits API devolvió ${response.status}`);
    }

    const pageCommits = await response.json();
    commits.push(
      ...pageCommits.map((item) => ({
        name: item.commit?.author?.name || item.author?.login || "Colaborador",
        email: item.commit?.author?.email || "",
        date: new Date(item.commit?.author?.date || item.commit?.committer?.date),
        subject: (item.commit?.message || "").split("\n")[0],
      }))
    );

    if (pageCommits.length < 100) {
      return {
        commits,
        headCommit: sha || pageCommits[0]?.sha || "unknown",
      };
    }
  }

  return { commits, headCommit: sha || "unknown" };
}

async function run() {
  try {
    console.log("Generando estadísticas reales de Git y consultando GitHub API...");

    // 1. Usar Git local cuando existe y la API de GitHub en builds sin carpeta .git.
    let gitData = process.env.VERCEL ? null : getLocalGitData();
    if (!gitData) {
      console.log("Repositorio local no disponible; consultando commits desde GitHub API...");
      try {
        gitData = await getGithubCommitData();
      } catch (error) {
        if (fs.existsSync(outputPath)) {
          console.warn(
            `No fue posible actualizar commits (${error.message}); se conserva el JSON confirmado.`
          );
          return;
        }
        throw error;
      }
    }
    const { commits, headCommit } = gitData;

    const totalCommits = commits.length;

    // Estructuras acumuladoras para commits, PRs e interacciones por squad.
    const commitsBySquad = {
      "Squad 1": 0,
      "Squad 2": 0,
      "Squad 3": 0,
      "Squad 4": 0,
      "Squad 5": 0,
      "Squad 6": 0,
      "Admin Master": 0,
    };
    const ownerStats = {};

    // 2. Consultar Pull Requests de GitHub API
    let pulls = [];
    let githubAvailable = false;
    let pullsByNumber = new Map();
    let prsBySquad = {
      "Squad 1": { total: 0, closed: 0, open: 0 },
      "Squad 2": { total: 0, closed: 0, open: 0 },
      "Squad 3": { total: 0, closed: 0, open: 0 },
      "Squad 4": { total: 0, closed: 0, open: 0 },
      "Squad 5": { total: 0, closed: 0, open: 0 },
      "Squad 6": { total: 0, closed: 0, open: 0 },
      "Admin Master": { total: 0, closed: 0, open: 0 },
    };

    try {
      const pullsRes = await fetch("https://api.github.com/repos/Cangregito/SyncUT/pulls?state=all&per_page=100", { headers: githubHeaders });
      if (pullsRes.ok) {
        pulls = await pullsRes.json();
        pullsByNumber = new Map(pulls.map((pr) => [pr.number, pr]));
        githubAvailable = true;
        console.log(`GitHub API: Se encontraron ${pulls.length} Pull Requests.`);
        
        pulls.forEach((pr) => {
          const sq = getSquadFromPullRequest(pr);
          if (prsBySquad[sq]) {
            prsBySquad[sq].total++;
            if (pr.merged_at) prsBySquad[sq].closed++;
            else prsBySquad[sq].open++;
          }
        });
      } else {
        console.warn("GitHub API devolvió código de error:", pullsRes.status);
      }
    } catch (err) {
      console.warn("Fallo al conectar con la API de GitHub:", err.message);
    }

    // 2.1 Agrupar commits por squad real. Los commits de merge de PR se asignan
    // al squad del PR, no al usuario que hizo click en "merge".
    commits.forEach((c) => {
      const member = identifyContributor(c.name, c.email);
      const commitSquad = getSquadFromCommit(c, pullsByNumber);
      if (commitsBySquad[commitSquad] !== undefined) {
        commitsBySquad[commitSquad]++;
      }
      if (!ownerStats[member.realName]) {
        ownerStats[member.realName] = {
          name: member.realName,
          squad: member.squad,
          role: member.role,
          commits: 0,
          pullRequests: 0,
        };
      }
      ownerStats[member.realName].commits++;
    });

    pulls.forEach((pr) => {
      const authorLogin = pr.user?.login?.toLowerCase();
      const member = MEMBER_MAPPING.find((item) =>
        item.githubUsernames.some((username) => username.toLowerCase() === authorLogin)
      );
      if (!member) {
        return;
      }
      if (!ownerStats[member.realName]) {
        ownerStats[member.realName] = {
          name: member.realName,
          squad: member.squad,
          role: member.role,
          commits: 0,
          pullRequests: 0,
        };
      }
      ownerStats[member.realName].pullRequests++;
    });

    const moduleEvidence = Object.entries(MODULE_EVIDENCE).map(([squad, meta]) => {
      const squadCommits = commits.filter((commit) => getSquadFromCommit(commit, pullsByNumber) === squad);
      const squadPulls = pulls.filter((pr) => getSquadFromPullRequest(pr) === squad);
      const contributors = new Set();

      squadCommits.forEach((commit) => {
        const member = identifyContributor(commit.name, commit.email);
        if (member.realName && member.realName !== "Colaborador") {
          contributors.add(member.realName);
        }
      });
      squadPulls.forEach((pr) => {
        const login = pr.user?.login?.toLowerCase();
        const member = MEMBER_MAPPING.find((item) =>
          item.githubUsernames.some((username) => username.toLowerCase() === login)
        );
        contributors.add(member?.realName ?? pr.user?.login ?? "GitHub User");
      });

      const activityCandidates = [
        ...squadCommits.map((commit) => ({
          date: commit.date,
          title: commit.subject,
          type: "commit",
        })),
        ...squadPulls.map((pr) => ({
          date: new Date(pr.updated_at || pr.created_at),
          title: `PR #${pr.number}: ${pr.title}`,
          type: pr.merged_at ? "pull_request_merged" : pr.state === "open" ? "pull_request_open" : "pull_request_closed",
        })),
      ].sort((a, b) => b.date - a.date);

      const lastActivity = activityCandidates[0] ?? null;
      const formattedLastActivity = formatDateTimeForEvidence(lastActivity?.date);
      const totalInteractions = squadCommits.length + squadPulls.length;

      return {
        squad,
        squadLabel: meta.squadLabel,
        name: meta.name,
        href: meta.href,
        description: meta.description,
        evidence: meta.evidence,
        totalInteractions,
        commits: squadCommits.length,
        pullRequests: squadPulls.length,
        mergedPullRequests: squadPulls.filter((pr) => Boolean(pr.merged_at)).length,
        openPullRequests: squadPulls.filter((pr) => pr.state === "open").length,
        contributors: Array.from(contributors).sort(),
        lastActivity: lastActivity
          ? {
              type: lastActivity.type,
              title: lastActivity.title,
              date: formattedLastActivity.date,
              time: formattedLastActivity.time,
              iso: formattedLastActivity.iso,
            }
          : null,
      };
    });

    // 3. Crear feed de actividades unificado (Commits + PRs)
    const recentActivities = [];

    // Agregar últimos 15 commits locales reales
    commits.slice(0, 15).forEach((c) => {
      const member = identifyContributor(c.name, c.email);
      const commitSquad = getSquadFromCommit(c, pullsByNumber);
      let module = getModuleFromSquad(commitSquad);
      const sub = c.subject.toLowerCase();

      let action = "validation";
      if (sub.includes("merge")) action = "merge";
      else if (sub.includes("fix") || sub.includes("bug")) action = "hotfix";
      else if (sub.includes("deploy") || sub.includes("release")) action = "deploy";
      else if (sub.includes("test")) action = "test";
      else if (sub.includes("feat") || sub.includes("add")) action = "validation";

      const localDate = c.date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
      const localTime = c.date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });

      recentActivities.push({
        user: member.realName,
        action,
        description: c.subject,
        module,
        squad: commitSquad,
        sprint: "Sprint 3",
        date: localDate,
        time: localTime,
        status: "Completado",
        impact: sub.includes("merge") || sub.includes("feat") ? "Alto" : "Medio",
      });
    });

    // Agregar PRs activos al feed
    pulls.slice(0, 5).forEach((pr) => {
      const sq = getSquadFromPullRequest(pr);
      const prDate = new Date(pr.created_at);
      const localDate = prDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
      const localTime = prDate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });

      recentActivities.push({
        user: pr.user?.login || "GitHub User",
        action: "approval",
        description: `Pull Request #${pr.number}: ${pr.title} (Estado: ${pr.state.toUpperCase()})`,
        module: getModuleFromSquad(sq),
        squad: sq,
        sprint: "Sprint 3",
        date: localDate,
        time: localTime,
        status: pr.merged_at ? "Fusionado" : pr.state === "open" ? "Abierto" : "Cerrado",
        impact: "Alto",
      });
    });

    // 4. Commits por semana (últimas 4 semanas)
    const now = new Date();
    const commitsByWeek = [
      { week: "W-3", commits: 0 },
      { week: "W-2", commits: 0 },
      { week: "W-1", commits: 0 },
      { week: "Actual", commits: 0 },
    ];

    commits.forEach((c) => {
      const diffDays = Math.floor((now - c.date) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        commitsByWeek[3].commits++;
      } else if (diffDays >= 7 && diffDays < 14) {
        commitsByWeek[2].commits++;
      } else if (diffDays >= 14 && diffDays < 21) {
        commitsByWeek[1].commits++;
      } else if (diffDays >= 21 && diffDays < 28) {
        commitsByWeek[0].commits++;
      }
    });

    // Formatear salida para JSON
    const outputData = {
      generatedAt: new Date().toISOString(),
      headCommit,
      githubAvailable,
      totalCommits,
      totalPRs: pulls.length,
      mergedPRs: pulls.filter((p) => Boolean(p.merged_at)).length,
      openPRs: pulls.filter((p) => p.state === "open").length,
      commitsBySquad: [
        { squad: "S1 (Justificaciones)", progreso: commitsBySquad["Squad 1"] },
        { squad: "S2 (Autenticación)", progreso: commitsBySquad["Squad 2"] },
        { squad: "S3 (Citas)", progreso: commitsBySquad["Squad 3"] },
        { squad: "S4 (Notificaciones)", progreso: commitsBySquad["Squad 4"] },
        { squad: "S5 (Incidencias)", progreso: commitsBySquad["Squad 5"] },
        { squad: "S6 (Chatbot)", progreso: commitsBySquad["Squad 6"] },
        { squad: "Admin (Dashboard Gobernanza)", progreso: commitsBySquad["Admin Master"] },
      ],
      prsBySquad: [
        { squad: "S1 (Justificaciones)", total: prsBySquad["Squad 1"].total, closed: prsBySquad["Squad 1"].closed },
        { squad: "S2 (Autenticación)", total: prsBySquad["Squad 2"].total, closed: prsBySquad["Squad 2"].closed },
        { squad: "S3 (Citas)", total: prsBySquad["Squad 3"].total, closed: prsBySquad["Squad 3"].closed },
        { squad: "S4 (Notificaciones)", total: prsBySquad["Squad 4"].total, closed: prsBySquad["Squad 4"].closed },
        { squad: "S5 (Incidencias)", total: prsBySquad["Squad 5"].total, closed: prsBySquad["Squad 5"].closed },
        { squad: "S6 (Chatbot)", total: prsBySquad["Squad 6"].total, closed: prsBySquad["Squad 6"].closed },
        { squad: "Admin (Dashboard Gobernanza)", total: prsBySquad["Admin Master"].total, closed: prsBySquad["Admin Master"].closed },
      ],
      commitsByWeek,
      moduleEvidence,
      recentActivities: recentActivities.slice(0, 25), // Mantener el feed conciso
      owners: Object.values(ownerStats)
        .sort((a, b) => b.commits - a.commits)
        .map((owner) => {
          const githubUsernames =
            MEMBER_MAPPING.find((member) => member.realName === owner.name)?.githubUsernames ?? [];
          const matchingPrs = pulls.filter((p) =>
            githubUsernames.some(
              (username) => p.user?.login?.toLowerCase() === username.toLowerCase()
            )
          );
          return {
            name: owner.name,
            squad: owner.squad,
            role: owner.role,
            tasks: owner.commits + (owner.pullRequests ?? 0),
            progress: Math.min((owner.commits + (owner.pullRequests ?? 0)) * 10, 100),
            weekly: `${owner.commits} commits · ${owner.pullRequests ?? matchingPrs.length} PRs`,
            prs: owner.pullRequests ?? matchingPrs.length,
            status: "activo",
          };
        }),
    };

    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), "utf-8");
    console.log(`Estadísticas unificadas de Git y GitHub API generadas en ${outputPath}`);
  } catch (error) {
    console.error("Error al compilar estadísticas:", error);
    process.exitCode = 1;
  }
}

function getModuleFromSquad(squad) {
  if (squad === "Squad 1") return "Justificaciones";
  if (squad === "Squad 2") return "Autenticación";
  if (squad === "Squad 3") return "Citas";
  if (squad === "Squad 4") return "Notificaciones";
  if (squad === "Squad 5") return "Incidencias";
  if (squad === "Squad 6") return "Chatbot";
  return "Dashboard Base";
}

run();
