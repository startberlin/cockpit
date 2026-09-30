import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UserAuthority } from "@/lib/permissions";
import {
  type AppVisibility,
  evaluateAppVisibility,
  externalToolVisibility,
} from "./visibility";

function authority(overrides: Partial<UserAuthority> = {}): UserAuthority {
  return {
    userId: "usr_test",
    status: "member",
    department: "events",
    positions: [],
    grants: [],
    ...overrides,
  };
}

const adminOnly: AppVisibility = { kind: "permission", action: "users.create" };

describe("evaluateAppVisibility", () => {
  it("denies everything when there is no authority", () => {
    assert.equal(
      evaluateAppVisibility(null, { kind: "any-app-user" }),
      false,
      "a signed-out user has no apps",
    );
  });

  it("any-app-user allows any status", () => {
    for (const status of ["onboarding", "member", "alumni"] as const) {
      assert.equal(
        evaluateAppVisibility(authority({ status }), { kind: "any-app-user" }),
        true,
      );
    }
  });

  it("status matches on the user's status", () => {
    const visibility: AppVisibility = {
      kind: "status",
      statuses: ["member"],
    };
    assert.equal(
      evaluateAppVisibility(authority({ status: "member" }), visibility),
      true,
    );
    assert.equal(
      evaluateAppVisibility(authority({ status: "alumni" }), visibility),
      false,
    );
  });

  it("permission delegates to evaluateAuth", () => {
    assert.equal(
      evaluateAppVisibility(
        authority({ grants: [{ grant: "admin" }] }),
        adminOnly,
      ),
      true,
    );
    assert.equal(evaluateAppVisibility(authority(), adminOnly), false);
  });

  // This is the reason AppVisibility exists as its own model rather than being
  // folded into the Action union. If it were, onboarding members would lose the
  // tools page, because evaluateAuth denies every action to inactive statuses.
  it("onboarding users pass status visibility but fail permission visibility", () => {
    const onboardingSuperAdmin = authority({
      status: "onboarding",
      grants: [{ grant: "super_admin" }],
    });

    assert.equal(
      evaluateAppVisibility(onboardingSuperAdmin, externalToolVisibility),
      true,
      "onboarding members must still see the external tools",
    );
    assert.equal(
      evaluateAppVisibility(onboardingSuperAdmin, adminOnly),
      false,
      "evaluateAuth denies every action to non-active authority statuses",
    );
  });

  it("external tools are hidden from alumni and cancelled members", () => {
    for (const status of ["alumni", "cancelled"] as const) {
      assert.equal(
        evaluateAppVisibility(authority({ status }), externalToolVisibility),
        false,
      );
    }
  });

  it("all requires every child, any requires one", () => {
    const member = authority({ grants: [{ grant: "admin" }] });
    const both: readonly AppVisibility[] = [externalToolVisibility, adminOnly];

    assert.equal(
      evaluateAppVisibility(member, { kind: "all", of: both }),
      true,
    );
    assert.equal(
      evaluateAppVisibility(authority(), { kind: "all", of: both }),
      false,
    );
    assert.equal(
      evaluateAppVisibility(authority(), { kind: "any", of: both }),
      true,
    );
  });

  it("empty all is true and empty any is false", () => {
    assert.equal(
      evaluateAppVisibility(authority(), { kind: "all", of: [] }),
      true,
    );
    assert.equal(
      evaluateAppVisibility(authority(), { kind: "any", of: [] }),
      false,
    );
  });
});
