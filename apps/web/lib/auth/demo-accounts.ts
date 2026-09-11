import "server-only";

import type { UserRole } from "./roles";

type DemoAccount = { email: string; password: string; fullName: string };

/**
 * Credenciales de las cuentas de exhibicion.
 *
 * Este modulo es `server-only`: nunca debe importarse desde un componente
 * cliente. Las contrasenas se resuelven desde el entorno para que un despliegue
 * publico pueda rotarlas sin tocar el codigo.
 */
const DEMO_PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD?.trim() || "SyncUT2026!";

const DEMO_ROLE_ACCOUNTS: Record<UserRole, DemoAccount> = {
  student: {
    email: process.env.DEMO_STUDENT_EMAIL?.trim() || "estudiante@syncut.test",
    password: DEMO_PASSWORD,
    fullName: "María López",
  },
  teacher: {
    email: process.env.DEMO_TEACHER_EMAIL?.trim() || "docente@syncut.test",
    password: DEMO_PASSWORD,
    fullName: "Dr. Andrés Hidalgo",
  },
  tutor: {
    email: process.env.DEMO_TUTOR_EMAIL?.trim() || "tutor@syncut.test",
    password: DEMO_PASSWORD,
    fullName: "Mtra. Fernanda Ruiz Hernandez",
  },
  admin: {
    email: process.env.DEMO_ADMIN_EMAIL?.trim() || "admin@syncut.test",
    password: DEMO_PASSWORD,
    fullName: "Admin SyncUT",
  },
};

/** `false` desactiva por completo el acceso rapido en un entorno publico. */
export function isDemoLoginEnabled(): boolean {
  return process.env.DEMO_LOGIN_ENABLED?.trim().toLowerCase() !== "false";
}

export function getDemoAccount(role: UserRole): DemoAccount {
  return DEMO_ROLE_ACCOUNTS[role];
}
