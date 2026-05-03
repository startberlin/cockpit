import "server-only";

import { getUserAuthority } from "@/db/authority";
import { getCurrentUser } from "@/db/user";
import {
  type Action,
  type DepartmentScope,
  type DepartmentScopedAction,
  evaluateAuth,
  type GlobalAction,
  isGlobalAction,
} from ".";

export function can(action: GlobalAction): Promise<boolean>;
export function can(
  action: DepartmentScopedAction,
  scope: DepartmentScope,
): Promise<boolean>;
export async function can(
  action: Action,
  scope?: DepartmentScope,
): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const authority = await getUserAuthority(user.id);
  if (!authority) return false;

  if (isGlobalAction(action)) {
    return evaluateAuth(authority, action);
  }

  if (!scope) {
    return false;
  }

  return evaluateAuth(authority, action, scope);
}
