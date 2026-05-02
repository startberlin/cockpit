import "server-only";

import { getUserAuthority } from "@/db/authority";
import { getCurrentUser } from "@/db/user";
import { type Action, evaluateAuth, type PermissionContext } from ".";

export async function can(
  action: Action,
  context: PermissionContext = {},
): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const authority = await getUserAuthority(user.id);
  if (!authority) return false;

  return evaluateAuth(authority, action, context);
}
