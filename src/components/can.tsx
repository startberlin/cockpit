"use client";

import { useCallback } from "react";
import type { Department } from "@/db/schema/auth";
import {
  type Action,
  type DepartmentScope,
  type DepartmentScopedAction,
  evaluateAuth,
  type GlobalAction,
  type GroupScope,
  type GroupScopedAction,
  isDepartmentScopedAction,
  isGlobalAction,
  isGroupScopedAction,
} from "@/lib/permissions";
import { useAuthority } from "@/lib/permissions/authority-context";

export type CanCheck = {
  (permission: GlobalAction): boolean;
  (
    permission: DepartmentScopedAction,
    user: { department: Department | null },
  ): boolean;
  (permission: GroupScopedAction, group: { isMember: boolean }): boolean;
};

interface CanComponentProps {
  children: React.ReactNode;
  className?: string;
}

type CanProps =
  | (CanComponentProps & {
      permission: GlobalAction;
      context?: never;
    })
  | (CanComponentProps & {
      permission: DepartmentScopedAction;
      context: { department: Department | null };
    })
  | (CanComponentProps & {
      permission: GroupScopedAction;
      context: { isMember: boolean };
    });

export function useCan(): CanCheck;
export function useCan(permission: GlobalAction): boolean;
export function useCan(
  permission: DepartmentScopedAction,
  user: { department: Department | null },
): boolean;
export function useCan(
  permission: GroupScopedAction,
  group: { isMember: boolean },
): boolean;
export function useCan(
  permission?: Action,
  resource?: {
    department?: Department | null;
    isMember?: boolean;
  },
) {
  const authority = useAuthority();
  const check = useCallback<CanCheck>(
    (
      action: Action,
      checkResource?: {
        department?: Department | null;
        isMember?: boolean;
      },
    ) => {
      if (!authority) {
        return false;
      }

      if (isGlobalAction(action)) {
        return evaluateAuth(authority, action);
      }

      if (isDepartmentScopedAction(action)) {
        const scope: DepartmentScope = {
          targetDepartment: checkResource?.department ?? null,
        };
        return evaluateAuth(authority, action, scope);
      }

      if (isGroupScopedAction(action)) {
        const scope: GroupScope = {
          isGroupMember: checkResource?.isMember ?? false,
        };
        return evaluateAuth(authority, action, scope);
      }

      return false;
    },
    [authority],
  );

  if (!permission) {
    return check;
  }

  if (isGlobalAction(permission)) {
    return check(permission);
  }

  if (isDepartmentScopedAction(permission)) {
    return check(permission, resource as { department: Department | null });
  }

  if (isGroupScopedAction(permission)) {
    return check(permission, resource as { isMember: boolean });
  }

  return false;
}

export function Can(props: CanProps) {
  const check = useCan();

  if (isGlobalAction(props.permission)) {
    return check(props.permission) ? props.children : null;
  }

  if (isDepartmentScopedAction(props.permission)) {
    const context = props.context as { department: Department | null };
    return check(props.permission, context) ? props.children : null;
  }

  if (isGroupScopedAction(props.permission)) {
    const context = props.context as { isMember: boolean };
    return check(props.permission, context) ? props.children : null;
  }

  return null;
}
