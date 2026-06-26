import { describe, expect, it } from "vitest";

import { PLATFORM_MODULES } from "@plataforma/sdk/contracts";

describe("platform module contracts", () => {
  it("keeps routes and module keys unique", () => {
    const routes = PLATFORM_MODULES.map((module) => module.route);
    const keys = PLATFORM_MODULES.map((module) => module.key);

    expect(new Set(routes).size).toBe(routes.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("assigns every module to an owner and at least one role", () => {
    for (const moduleContract of PLATFORM_MODULES) {
      expect(moduleContract.owner.length).toBeGreaterThan(0);
      expect(moduleContract.allowedRoles.length).toBeGreaterThan(0);
      expect(moduleContract.platformProvides.length).toBeGreaterThan(0);
      expect(moduleContract.squadOwns.length).toBeGreaterThan(0);
    }
  });
});
