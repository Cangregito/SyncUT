import { describe, expect, it } from "vitest";

import {
  canAccessAdmin,
  canAccessModule,
  getModulesForRole,
  hasPermission,
  isUserRole,
  ROLE_MODULES,
  toUserRole,
} from "./roles";

describe("role helpers", () => {
  it("accepts only platform roles", () => {
    expect(isUserRole("admin")).toBe(true);
    expect(isUserRole("student")).toBe(true);
    expect(isUserRole("owner")).toBe(false);
    expect(isUserRole(null)).toBe(false);
  });

  it("falls back to the least privileged role", () => {
    expect(toUserRole("teacher")).toBe("teacher");
    expect(toUserRole("super-admin")).toBe("student");
    expect(toUserRole(undefined)).toBe("student");
  });

  it("reserves the governance route for administrators", () => {
    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("coordinator")).toBe(false);
    expect(canAccessAdmin("student")).toBe(false);
  });

  it("maps role permissions to modules", () => {
    expect(hasPermission("student", "justifications:create")).toBe(true);
    expect(hasPermission("student", "governance:view")).toBe(false);
    expect(hasPermission("coordinator", "chatbot:manage")).toBe(true);
    expect(hasPermission("teacher", "justifications:academic_note")).toBe(true);
    expect(hasPermission("teacher", "justifications:resolve")).toBe(false);
    expect(hasPermission("tutor", "appointments:availability")).toBe(true);
    expect(hasPermission("tutor", "incidents:assign")).toBe(false);
    expect(hasPermission("coordinator", "incidents:assign")).toBe(true);

    const adminModule = ROLE_MODULES.find((module) => module.href === "/admin");
    expect(adminModule).toBeDefined();
    expect(canAccessModule("admin", adminModule!)).toBe(true);
    expect(canAccessModule("tutor", adminModule!)).toBe(false);
  });

  it("returns only modules visible for each role", () => {
    expect(getModulesForRole("student").some((module) => module.href === "/admin")).toBe(false);
    expect(getModulesForRole("admin").some((module) => module.href === "/admin")).toBe(true);
  });
});
