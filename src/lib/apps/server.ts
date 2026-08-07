import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { getUserAuthority } from "@/db/authority";
import { getCurrentUser } from "@/db/user";
import type { UserAuthority } from "@/lib/permissions";
import {
  type AppSection,
  getApp,
  visibleAppSections,
  visibleApps,
} from "./registry";
import type { AppDefinition } from "./types";
import { evaluateAppVisibility } from "./visibility";

/**
 * Server-side access checks for apps.
 *
 * The registry is advisory: it decides what to *render*. Routes must assert
 * independently, because a hidden card is not a security boundary. Enforcement
 * has three layers:
 *
 *   1. `(apps)/<slug>/layout.tsx` calls `requireAppAccess()` — gates page renders.
 *   2. Every server action in the module calls `can()` itself — layouts do NOT
 *      protect server actions, which are independently addressable POST endpoints.
 *   3. Client `useCan()` / `visibleInternalApps()` — affordances only.
 */

/**
 * Both `getCurrentUser` and `getUserAuthority` are already React-cached, so this
 * costs no extra query when the layout has already resolved authority.
 */
export const getCurrentAuthority = cache(
  async (): Promise<UserAuthority | null> => {
    const user = await getCurrentUser();
    if (!user) return null;
    return getUserAuthority(user.id);
  },
);

export async function getVisibleApps(): Promise<AppDefinition[]> {
  return visibleApps(await getCurrentAuthority());
}

export async function getVisibleAppSections(): Promise<AppSection[]> {
  return visibleAppSections(await getCurrentAuthority());
}

export async function canAccessApp(id: string): Promise<boolean> {
  const app = getApp(id);
  if (!app) return false;
  return evaluateAppVisibility(await getCurrentAuthority(), app.visibility);
}

/**
 * Assert access to an app, or bounce to the launcher. Call this in the app's
 * `layout.tsx` so it covers every nested route, including ones added later.
 */
export async function requireAppAccess(id: string): Promise<void> {
  if (!(await canAccessApp(id))) {
    redirect("/tools");
  }
}
