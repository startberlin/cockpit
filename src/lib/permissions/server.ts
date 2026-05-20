import "server-only";

import { and, eq } from "drizzle-orm";
import db from "@/db";
import { getUserAuthority } from "@/db/authority";
import type { Department, UserStatus } from "@/db/schema/auth";
import { usersToGroups } from "@/db/schema/group";
import { getCurrentUser } from "@/db/user";
import {
  type Action,
  evaluateAuth,
  type GlobalAction,
  type GroupScopedAction,
  isGlobalAction,
  isGroupScopedAction,
  isUserScopedAction,
  type UserScopedAction,
} from ".";

export function can(action: GlobalAction): Promise<boolean>;
export function can(
  action: UserScopedAction,
  user: { department: Department | null; status: UserStatus },
): Promise<boolean>;
export function can(
  action: GroupScopedAction,
  group: { id: string },
): Promise<boolean>;
export async function can(
  action: Action,
  resource?: {
    department?: Department | null;
    status?: UserStatus;
    id?: string;
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
    const department = resource?.department ?? null;
    const status = resource?.status ?? "member";
    return evaluateAuth(authority, action, {
      targetDepartment: department,
      targetStatus: status,
    });
  }

  if (isGroupScopedAction(action)) {
    const groupId = resource?.id;
    if (!groupId) return false;
    const membership = await db
      .select({ userId: usersToGroups.userId })
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
    });
  }

  return false;
}
