import "server-only";

import { and, eq } from "drizzle-orm";
import db from "@/db";
import { getUserAuthority } from "@/db/authority";
import type { Department } from "@/db/schema/auth";
import { usersToGroups } from "@/db/schema/group";
import { getCurrentUser } from "@/db/user";
import {
  type Action,
  evaluateAuth,
  type GlobalAction,
  type GroupScopedAction,
  isGlobalAction,
  isGroupScopedAction,
  isUnscopedViewAction,
  isUserScopedAction,
  type UnscopedViewAction,
  type UserScopedAction,
} from ".";

export function can(action: GlobalAction): Promise<boolean>;
export function can(
  action: UnscopedViewAction,
  user?: { department?: Department | null; id?: string },
): Promise<boolean>;
export function can(
  action: UserScopedAction,
  user: { department?: Department | null; id?: string },
): Promise<boolean>;
export function can(
  action: GroupScopedAction,
  group: { id: string },
): Promise<boolean>;
export function can(
  action: GroupScopedAction,
  scope: { isMember: boolean },
): Promise<boolean>;
export async function can(
  action: Action,
  resource?: {
    department?: Department | null;
    id?: string;
    isMember?: boolean;
  },
): Promise<boolean> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return false;

  const authority = await getUserAuthority(currentUser.id);
  if (!authority) return false;

  if (isGlobalAction(action)) {
    return evaluateAuth(authority, action);
  }

  if (isUserScopedAction(action)) {
    const targetDepartment =
      resource !== undefined
        ? (resource.department ?? null)
        : isUnscopedViewAction(action)
          ? undefined
          : null;
    return evaluateAuth(authority, action, { targetDepartment });
  }

  if (isGroupScopedAction(action)) {
    if (resource && "isMember" in resource) {
      return evaluateAuth(authority, action, {
        isGroupMember: resource.isMember ?? false,
        isGroupManager: false,
      });
    }
    const groupId = resource?.id;
    if (!groupId) return false;
    const membership = await db
      .select({ userId: usersToGroups.userId, role: usersToGroups.role })
      .from(usersToGroups)
      .where(
        and(
          eq(usersToGroups.groupId, groupId),
          eq(usersToGroups.userId, currentUser.id),
        ),
      )
      .limit(1);
    return evaluateAuth(authority, action, {
      isGroupMember: membership.length > 0,
      isGroupManager: membership[0]?.role === "manager",
    });
  }

  return false;
}
