import "server-only";

import { getUserAuthority } from "@/db/authority";
import { getCurrentUser } from "@/db/user";
import { type Action, evaluateAuth, type PermissionContextArg } from ".";

export async function can<ActionName extends Action>(
  action: ActionName,
  ...contextArg: PermissionContextArg<ActionName>
): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const authority = await getUserAuthority(user.id);
  if (!authority) return false;

  return evaluateAuth(authority, action, ...contextArg);
}
