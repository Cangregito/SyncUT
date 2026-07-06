export const USER_ROLES = [
  "student",
  "teacher",
  "tutor",
  "admin",
  "coordinator",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type RolePermission =
  | "dashboard:view"
  | "justifications:create"
  | "justifications:review"
  | "appointments:create"
  | "appointments:manage"
  | "notifications:view"
  | "incidents:create"
  | "incidents:manage"
  | "chatbot:use"
  | "chatbot:manage"
  | "governance:view";

export type RoleModule = {
  href: string;
  label: string;
  icon: string;
  squad?: string;
  permissions: readonly RolePermission[];
};

export const ROLE_LABELS: Record<UserRole, string> = {
  student: "Estudiante",
  teacher: "Docente",
  tutor: "Tutor",
  coordinator: "Coordinacion",
  admin: "Administrador",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  student: "Solicita citas, registra justificaciones y da seguimiento a sus reportes.",
  teacher: "Atiende incidencias academicas, valida contexto de materias y registra seguimiento.",
  tutor: "Gestiona tutorias, revisa solicitudes de estudiantes asignados y acompana casos escalados.",
  coordinator: "Supervisa flujo operativo, reasigna casos y mantiene el seguimiento institucional.",
  admin: "Gobierna roles, datos, seguridad, auditoria y salud completa de la plataforma.",
};

export const DEMO_ROLE_ACCOUNTS: Record<
  UserRole,
  { email: string; password: string; fullName: string }
> = {
  student: {
    email: "estudiante@syncut.test",
    password: "SyncUT2026!",
    fullName: "María López",
  },
  teacher: {
    email: "docente@syncut.test",
    password: "SyncUT2026!",
    fullName: "Dr. Andrés Hidalgo",
  },
  tutor: {
    email: "tutor@syncut.test",
    password: "SyncUT2026!",
    fullName: "Mtra. Fernanda Ruiz",
  },
  coordinator: {
    email: "coordinacion@syncut.test",
    password: "SyncUT2026!",
    fullName: "Ana Ramos",
  },
  admin: {
    email: "admin@syncut.test",
    password: "SyncUT2026!",
    fullName: "Admin SyncUT",
  },
};

export const ROLE_PERMISSIONS: Record<UserRole, readonly RolePermission[]> = {
  student: [
    "dashboard:view",
    "justifications:create",
    "appointments:create",
    "notifications:view",
    "incidents:create",
    "chatbot:use",
  ],
  teacher: [
    "dashboard:view",
    "justifications:review",
    "appointments:manage",
    "notifications:view",
    "incidents:manage",
    "chatbot:use",
  ],
  tutor: [
    "dashboard:view",
    "justifications:review",
    "appointments:manage",
    "notifications:view",
    "incidents:manage",
    "chatbot:use",
  ],
  coordinator: [
    "dashboard:view",
    "justifications:review",
    "appointments:manage",
    "notifications:view",
    "incidents:manage",
    "chatbot:use",
    "chatbot:manage",
  ],
  admin: [
    "dashboard:view",
    "justifications:create",
    "justifications:review",
    "appointments:create",
    "appointments:manage",
    "notifications:view",
    "incidents:create",
    "incidents:manage",
    "chatbot:use",
    "chatbot:manage",
    "governance:view",
  ],
};

export const ROLE_MODULES: readonly RoleModule[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", permissions: ["dashboard:view"] },
  { href: "/justificaciones", label: "Justificaciones", icon: "gavel", squad: "Squad 1", permissions: ["justifications:create", "justifications:review"] },
  { href: "/citas", label: "Citas con Tutor", icon: "calendar_month", squad: "Squad 3", permissions: ["appointments:create", "appointments:manage"] },
  { href: "/notificaciones", label: "Notificaciones", icon: "notifications", squad: "Squad 4", permissions: ["notifications:view"] },
  { href: "/incidencias", label: "Reportes Incidencias", icon: "rule", squad: "Squad 5", permissions: ["incidents:create", "incidents:manage"] },
  { href: "/chatbot", label: "Asistente Chatbot", icon: "chat", squad: "Squad 6", permissions: ["chatbot:use", "chatbot:manage"] },
  { href: "/admin", label: "Panel Gobernanza", icon: "monitoring", squad: "Admin Master", permissions: ["governance:view"] },
];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export function toUserRole(value: unknown): UserRole {
  return isUserRole(value) ? value : "student";
}

export function canAccessAdmin(role: UserRole): boolean {
  return hasPermission(role, "governance:view");
}

export function hasPermission(role: UserRole, permission: RolePermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAccessModule(role: UserRole, module: RoleModule): boolean {
  return module.permissions.some((permission) => hasPermission(role, permission));
}

export function getModulesForRole(role: UserRole): RoleModule[] {
  return ROLE_MODULES.filter((module) => canAccessModule(role, module));
}
