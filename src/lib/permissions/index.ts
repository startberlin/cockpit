import type { Role } from "@/db/schema/auth";

export const PERMISSIONS = {
  "users.manage": ["admin"],
  "users.create": ["admin"],
  "groups.view_all": ["admin", "board", "department_lead"],
  "groups.create": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Action = keyof typeof PERMISSIONS;

export type RoleList = readonly Role[];

export function hasAnyRequiredRole(
  userRoles: RoleList,
  requiredRoles: RoleList,
): boolean {
  return requiredRoles.some((role) => userRoles.includes(role));
}
