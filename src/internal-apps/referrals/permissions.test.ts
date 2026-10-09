import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { visibleApps } from "@/lib/apps/registry";
import { DEPARTMENT_IDS } from "@/lib/departments";
import { evaluateAuth, type UserAuthority } from "@/lib/permissions";

const authority = (overrides: Partial<UserAuthority> = {}): UserAuthority => ({
  userId: "usr_test",
  status: "member",
  department: "events",
  positions: [],
  grants: [],
  ...overrides,
});

describe("referral access policy", () => {
  it("gives active members and supporting alumni their own app", () => {
    for (const status of ["member", "supporting_alumni"] as const) {
      assert.equal(
        evaluateAuth(authority({ status }), "apps.referrals.access"),
        true,
      );
      assert.equal(
        visibleApps(authority({ status })).some(
          (app) => app.id === "referrals",
        ),
        true,
      );
    }
  });
  it("denies onboarding, alumni and cancelled users, including inactive superadmins", () => {
    for (const status of ["onboarding", "alumni", "cancelled"] as const) {
      const user = authority({ status, grants: [{ grant: "super_admin" }] });
      assert.equal(evaluateAuth(user, "apps.referrals.access"), false);
      assert.equal(evaluateAuth(user, "apps.referrals.overview"), false);
    }
  });
  it("allows every department head and co-lead to view the overview", () => {
    for (const department of DEPARTMENT_IDS)
      for (const position of [
        "department_head",
        "department_co_lead",
      ] as const) {
        assert.equal(
          evaluateAuth(
            authority({
              positions: [{ position, scope: "department", department }],
            }),
            "apps.referrals.overview",
          ),
          true,
        );
      }
    assert.equal(
      evaluateAuth(
        authority({
          positions: [{ position: "head_of_finance", scope: "global" }],
        }),
        "apps.referrals.overview",
      ),
      true,
    );
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "super_admin" }] }),
        "apps.referrals.overview",
      ),
      true,
    );
  });
  it("does not expose everyone's counts to ordinary members or unrelated grants", () => {
    assert.equal(evaluateAuth(authority(), "apps.referrals.overview"), false);
    for (const grant of ["admin", "people_admin", "finance_admin"] as const)
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant }] }),
          "apps.referrals.overview",
        ),
        false,
      );
  });
});
