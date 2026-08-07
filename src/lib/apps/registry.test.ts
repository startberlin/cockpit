import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UserAuthority } from "@/lib/permissions";
import {
  appSectionCounts,
  apps,
  isInternalApp,
  RESERVED_APP_PATHS,
  visibleAppSections,
} from "./registry";
import { appCategories } from "./types";

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

describe("app registry", () => {
  it("has unique ids", () => {
    const ids = apps.map((app) => app.id);
    assert.deepEqual([...new Set(ids)], ids);
  });

  it("has unique analytics ids", () => {
    const ids = apps.map((app) => app.analyticsId);
    assert.deepEqual(
      [...new Set(ids)],
      ids,
      "PostHog insights key off analyticsId — duplicates merge two apps' events",
    );
  });

  it("declares a known category for every app", () => {
    for (const app of apps) {
      assert.ok(
        (appCategories as readonly string[]).includes(app.category),
        `${app.id} has unknown category ${app.category}`,
      );
    }
  });

  it("gives internal apps unique base paths that do not collide with the shell", () => {
    const internal = apps.filter(isInternalApp);
    const paths = internal.map((app) => app.basePath);

    assert.deepEqual([...new Set(paths)], paths, "duplicate basePath");

    for (const path of paths) {
      assert.ok(
        !(RESERVED_APP_PATHS as readonly string[]).includes(path),
        `${path} collides with an existing route`,
      );
      assert.ok(path.startsWith("/"), `${path} must be absolute`);
      assert.ok(!path.endsWith("/"), `${path} must not have a trailing slash`);
    }
  });

  it("external apps with a link launcher point somewhere absolute", () => {
    for (const app of apps) {
      if (app.kind !== "external" || app.launcher.type !== "link") continue;
      assert.ok(
        app.launcher.href.startsWith("https://"),
        `${app.id} link launcher must be an https URL`,
      );
    }
  });

  it("shows every external tool to onboarding members", () => {
    const sections = visibleAppSections(authority({ status: "onboarding" }));
    const visibleIds = sections.flatMap((s) => s.apps.map((a) => a.id));
    const externalIds = apps
      .filter((app) => app.kind === "external")
      .map((app) => app.id);

    assert.deepEqual(
      visibleIds.filter((id) => externalIds.includes(id)),
      externalIds,
      "onboarding members must still be able to join the external tools",
    );
  });

  it("hides every app from alumni and cancelled members", () => {
    for (const status of ["alumni", "cancelled"] as const) {
      assert.deepEqual(visibleAppSections(authority({ status })), []);
    }
  });

  it("orders sections by appCategories and drops empty ones", () => {
    const sections = visibleAppSections(authority());
    const order = sections.map((s) => s.category);

    assert.deepEqual(
      order,
      appCategories.filter((c) => order.includes(c)),
      "sections must follow appCategories order",
    );
    for (const section of sections) {
      assert.ok(section.apps.length > 0, "empty sections must be dropped");
    }
  });

  it("skeleton counts cover the largest possible rendering", () => {
    const counts = new Map(
      appSectionCounts().map((s) => [s.category, s.count]),
    );

    for (const section of visibleAppSections(authority())) {
      assert.ok(
        (counts.get(section.category) ?? 0) >= section.apps.length,
        `skeleton for ${section.category} is smaller than what renders`,
      );
    }
  });
});
