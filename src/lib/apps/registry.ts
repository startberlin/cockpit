import { referralsApp } from "@/internal-apps/referrals/app";
import type { UserAuthority } from "@/lib/permissions";
import { externalApps } from "./external";
import {
  APP_CATEGORY_LABELS,
  type AppCategory,
  type AppDefinition,
  appCategories,
  type InternalAppDefinition,
} from "./types";
import { evaluateAppVisibility } from "./visibility";

/**
 * Every app the launcher knows about.
 *
 * Internal apps are declared in `src/internal-apps/<slug>/app.ts` and registered here.
 * Registration is an explicit array rather than a side-effecting `register()`
 * call so the list is deterministic and tree-shakeable.
 *
 * This file is imported by both server components and the client sidebar. Keep
 * it free of `server-only`, `@/db`, and JSX.
 */
const appDefinitions = [
  referralsApp,
  ...externalApps,
] as const satisfies readonly AppDefinition[];

/**
 * Literal union of every registered app id. The icon and dialog maps in
 * `src/components/apps/` are typed against this, so adding an app without
 * giving it an icon (or a launcher, if it uses a dialog) fails to compile.
 */
export type AppId = (typeof appDefinitions)[number]["id"];

/**
 * Ids of external apps launched by a dialog rather than a link. Derived from the
 * literal definitions (not from `apps`, which is widened), so the dialog map in
 * `src/components/apps/launchers.tsx` can be checked exhaustively.
 */
export type DialogAppId = Extract<
  (typeof appDefinitions)[number],
  { kind: "external"; launcher: { type: "dialog" } }
>["id"];

/**
 * Widened for iteration. `appDefinitions` keeps the literal types that `AppId`
 * is derived from; consumers want the union, not eight singleton object types.
 */
export const apps: readonly AppDefinition[] = appDefinitions;

/**
 * Top-level route segments that are already taken by the shell. An internal
 * app's `basePath` may not collide with one — see `registry.test.ts`.
 * `/` is included because next.config.ts redirects it to /membership.
 */
export const RESERVED_APP_PATHS = [
  "/",
  "/admin",
  "/api",
  "/auth",
  "/groups",
  "/maintenance",
  "/membership",
  "/onboarding",
  "/org-chart",
  "/payments",
  "/people",
  "/r",
  "/tools",
] as const;

export function getApp(id: string): AppDefinition | undefined {
  return apps.find((app) => app.id === id);
}

export function isInternalApp(
  app: AppDefinition,
): app is InternalAppDefinition {
  return app.kind === "internal";
}

export function visibleApps(authority: UserAuthority | null): AppDefinition[] {
  return apps.filter((app) => evaluateAppVisibility(authority, app.visibility));
}

export interface AppSection {
  category: AppCategory;
  label: string;
  apps: AppDefinition[];
}

/** Apps grouped into launcher sections, in `appCategories` order. Empty sections are dropped. */
export function visibleAppSections(
  authority: UserAuthority | null,
): AppSection[] {
  const visible = visibleApps(authority);

  return appCategories
    .map((category) => ({
      category,
      label: APP_CATEGORY_LABELS[category],
      apps: visible.filter((app) => app.category === category),
    }))
    .filter((section) => section.apps.length > 0);
}

/**
 * Section sizes ignoring visibility, for the launcher's loading skeleton.
 * `loading.tsx` renders before any await, so it cannot know the user's authority;
 * registry totals are the correct upper bound and keep the skeleton in step with
 * the registry automatically.
 */
export function appSectionCounts(): { category: AppCategory; count: number }[] {
  return appCategories
    .map((category) => ({
      category,
      count: apps.filter((app) => app.category === category).length,
    }))
    .filter((section) => section.count > 0);
}
