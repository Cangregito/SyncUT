export const USER_ROLES = [
  "student",
  "teacher",
  "tutor",
  "admin",
  "coordinator",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export function toUserRole(value: unknown): UserRole {
  return isUserRole(value) ? value : "student";
}

export function canAccessAdmin(role: UserRole): boolean {
  return role === "admin";
}
