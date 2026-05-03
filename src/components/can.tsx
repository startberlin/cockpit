"use client";

import { useCallback } from "react";
import {
  type Action,
  type DepartmentScope,
  type DepartmentScopedAction,
  evaluateAuth,
  type GlobalAction,
  isGlobalAction,
} from "@/lib/permissions";
import { useAuthority } from "@/lib/permissions/authority-context";

export type CanCheck = {
  (permission: GlobalAction): boolean;
  (permission: DepartmentScopedAction, scope: DepartmentScope): boolean;
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
      context: DepartmentScope;
    });

export function useCan(): CanCheck;
export function useCan(permission: GlobalAction): boolean;
export function useCan(
  permission: DepartmentScopedAction,
  scope: DepartmentScope,
): boolean;
export function useCan(permission?: Action, scope?: DepartmentScope) {
  const authority = useAuthority();
  const check = useCallback<CanCheck>(
    (action: Action, checkScope?: DepartmentScope) => {
      if (!authority) {
        return false;
      }

      if (isGlobalAction(action)) {
        return evaluateAuth(authority, action);
      }

      if (!checkScope) {
        return false;
      }

      return evaluateAuth(authority, action, checkScope);
    },
    [authority],
  );

  if (!permission) {
    return check;
  }

  if (isGlobalAction(permission)) {
    return check(permission);
  }

  if (!scope) {
    return false;
  }

  return check(permission, scope);
}

export function Can(props: CanProps) {
  const check = useCan();

  if (isGlobalAction(props.permission)) {
    const can = check(props.permission);
    return can ? props.children : null;
  }

  const can = check(
    props.permission as DepartmentScopedAction,
    props.context as DepartmentScope,
  );
  return can ? props.children : null;
}
