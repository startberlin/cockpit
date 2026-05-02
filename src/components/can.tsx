"use client";

import { useCallback } from "react";
import {
  type Action,
  evaluateAuth,
  type PermissionContext,
} from "@/lib/permissions";
import { useAuthority } from "@/lib/permissions/authority-context";

interface CanProps {
  children: React.ReactNode;
  permission: Action;
  context?: PermissionContext;
  className?: string;
}

type CanCheck = (permission: Action, context?: PermissionContext) => boolean;

export function useCan(): CanCheck;
export function useCan(
  permission: Action,
  context?: PermissionContext,
): boolean;
export function useCan(permission?: Action, context: PermissionContext = {}) {
  const authority = useAuthority();
  const check = useCallback<CanCheck>(
    (action, checkContext = {}) =>
      authority ? evaluateAuth(authority, action, checkContext) : false,
    [authority],
  );

  return permission ? check(permission, context) : check;
}

export function Can({ children, permission, context }: CanProps) {
  const can = useCan(permission, context);

  return can ? children : null;
}
