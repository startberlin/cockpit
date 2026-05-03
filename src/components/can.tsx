"use client";

import { useCallback } from "react";
import {
  type Action,
  evaluateAuth,
  type PermissionContextArg,
  type PermissionContexts,
} from "@/lib/permissions";
import { useAuthority } from "@/lib/permissions/authority-context";

type CanCheck = <ActionName extends Action>(
  permission: ActionName,
  ...contextArg: PermissionContextArg<ActionName>
) => boolean;

interface CanComponentProps<ActionName extends Action> {
  children: React.ReactNode;
  permission: ActionName;
  className?: string;
}

type CanPropsWithContext<ActionName extends Action> =
  CanComponentProps<ActionName> &
    (PermissionContexts[ActionName] extends undefined
      ? { context?: never }
      : { context: PermissionContexts[ActionName] });

export function useCan(): CanCheck;
export function useCan<ActionName extends Action>(
  permission: ActionName,
  ...contextArg: PermissionContextArg<ActionName>
): boolean;
export function useCan<ActionName extends Action>(
  permission?: ActionName,
  ...contextArg: PermissionContextArg<ActionName>
) {
  const authority = useAuthority();
  const check = useCallback<CanCheck>(
    (action, ...checkContextArg) =>
      authority ? evaluateAuth(authority, action, ...checkContextArg) : false,
    [authority],
  );

  return permission ? check(permission, ...contextArg) : check;
}

export function Can<ActionName extends Action>({
  children,
  permission,
  context,
}: CanPropsWithContext<ActionName>) {
  const can = useCan(
    permission,
    ...((context === undefined
      ? []
      : [context]) as PermissionContextArg<ActionName>),
  );

  return can ? children : null;
}
