import { describe, expect, it } from "vitest";

import { canAccessAdmin, isUserRole, toUserRole } from "./roles";

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
});
