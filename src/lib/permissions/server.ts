import "server-only";

import { getCurrentUser } from "@/db/user";
import { type Action, hasAnyRequiredRole, PERMISSIONS } from ".";

export async function can(action: Action): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const allowedRoles = PERMISSIONS[action];
  if (!allowedRoles) return false;

  return hasAnyRequiredRole(user.roles, allowedRoles);
}
