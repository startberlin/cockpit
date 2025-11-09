"use client";

import {
  type Action,
  hasAnyRequiredRole,
  PERMISSIONS,
} from "@/lib/permissions";
import { useRoles } from "@/lib/permissions/roles-context";

interface CanProps {
  children: React.ReactNode;
  permission: Action;
  className?: string;
}

export function Can({ children, permission }: CanProps) {
  const roles = useRoles();
  const can = hasAnyRequiredRole(roles, PERMISSIONS[permission]);

  return can ? children : null;
}
