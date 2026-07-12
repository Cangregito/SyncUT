export const USER_ROLES = [
  "student",
  "teacher",
  "tutor",
  "admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type RolePermission =
  | "dashboard:view"
  | "justifications:create"
  | "justifications:academic_note"
  | "justifications:tutor_followup"
  | "justifications:resolve"
  | "appointments:create"
  | "appointments:availability"
  | "appointments:confirm"
  | "appointments:attendance"
  | "appointments:session_note"
  | "appointments:oversight"
  | "notifications:view"
  | "notifications:send"
  | "incidents:create"
  | "incidents:comment"
  | "incidents:assign"
  | "incidents:resolve"
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
  admin: "Administrador",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  student: "Solicita citas, registra justificaciones y da seguimiento a sus reportes.",
  teacher: "Valida contexto academico, aporta evidencia docente y comenta incidencias asignadas.",
  tutor: "Gestiona tutorias, resuelve justificaciones, asigna incidencias y supervisa el flujo institucional.",
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
    fullName: "Mtra. Fernanda Ruiz Hernandez",
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
    "justifications:academic_note",
    "notifications:view",
    "incidents:comment",
    "chatbot:use",
  ],
  tutor: [
    "dashboard:view",
    "justifications:tutor_followup",
    "justifications:resolve",
    "appointments:availability",
    "appointments:confirm",
    "appointments:attendance",
    "appointments:session_note",
    "appointments:oversight",
    "notifications:view",
    "notifications:send",
    "incidents:comment",
    "incidents:assign",
    "incidents:resolve",
    "chatbot:use",
    "chatbot:manage",
  ],
  admin: [
    "governance:view",
  ],
};

export const ROLE_MODULES: readonly RoleModule[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", permissions: ["dashboard:view"] },
  {
    href: "/justificaciones",
    label: "Justificaciones",
    icon: "gavel",
    squad: "Squad 1",
    permissions: ["justifications:create", "justifications:academic_note", "justifications:tutor_followup", "justifications:resolve"],
  },
  {
    href: "/equipo",
    label: "Equipo Tutorial",
    icon: "groups",
    squad: "Tutoría",
    permissions: ["appointments:create", "appointments:availability", "justifications:tutor_followup", "notifications:send"],
  },
  {
    href: "/citas",
    label: "Citas con Tutor",
    icon: "calendar_month",
    squad: "Squad 3",
    permissions: ["appointments:create", "appointments:availability", "appointments:confirm", "appointments:attendance", "appointments:session_note", "appointments:oversight"],
  },
  { href: "/notificaciones", label: "Notificaciones", icon: "notifications", squad: "Squad 4", permissions: ["notifications:view"] },
  { href: "/incidencias", label: "Reportes Incidencias", icon: "rule", squad: "Squad 5", permissions: ["incidents:create", "incidents:comment", "incidents:assign", "incidents:resolve"] },
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
