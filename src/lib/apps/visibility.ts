import type { UserStatus } from "@/db/schema/auth";
import {
  evaluateAuth,
  type GlobalAction,
  type UserAuthority,
} from "@/lib/permissions";

/**
 * Whether an app appears in the launcher and the sidebar for a given user.
 *
 * This is deliberately NOT part of the `Action` union in
 * `@/lib/permissions/evaluate`. `evaluateAuth` denies every action to users whose
 * status is not an active authority status — which includes `onboarding`. But
 * onboarding members must still see the external tools so they can join Slack,
 * Notion, and the rest. So app visibility is a composite over *status* and
 * *permissions*, with permissions as one leaf rather than the whole model.
 *
 * Pure and isomorphic: no `server-only`, no db, no React. The same `UserAuthority`
 * backs `getUserAuthority()` on the server and `useAuthority()` on the client.
 */
export type AppVisibility =
  /** Any user who can reach the app shell at all. */
  | { kind: "any-app-user" }
  | { kind: "status"; statuses: readonly UserStatus[] }
  /**
   * Global actions only: app-level access is unscoped, so there is no target
   * department or group to pass. Note this is always false for `onboarding`.
   */
  | { kind: "permission"; action: GlobalAction }
  | { kind: "all"; of: readonly AppVisibility[] }
  | { kind: "any"; of: readonly AppVisibility[] };

export function evaluateAppVisibility(
  authority: UserAuthority | null,
  visibility: AppVisibility,
): boolean {
  if (!authority) return false;

  switch (visibility.kind) {
    case "any-app-user":
      return true;
    case "status":
      return visibility.statuses.includes(authority.status);
    case "permission":
      return evaluateAuth(authority, visibility.action);
    case "all":
      return visibility.of.every((v) => evaluateAppVisibility(authority, v));
    case "any":
      return visibility.of.some((v) => evaluateAppVisibility(authority, v));
  }
}

/**
 * Statuses that may use the launcher. `alumni` and `cancelled` are excluded —
 * /tools redirects them to /membership.
 */
export const APP_USER_STATUSES = [
  "onboarding",
  "member",
  "supporting_alumni",
] as const satisfies readonly UserStatus[];

/** Visibility shared by every external SaaS tool. */
export const externalToolVisibility: AppVisibility = {
  kind: "status",
  statuses: APP_USER_STATUSES,
};
