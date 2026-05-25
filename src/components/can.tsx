"use client";

import { useCallback, useContext, useId, useLayoutEffect } from "react";
import { HidableGroupContext } from "@/components/hidable-group-context";
import type { Department } from "@/db/schema/auth";
import {
  type Action,
  evaluateAuth,
  type GlobalAction,
  type GroupScope,
  type GroupScopedAction,
  isGlobalAction,
  isGroupScopedAction,
  isUnscopedViewAction,
  isUserScopedAction,
  type UnscopedViewAction,
  type UserScope,
  type UserScopedAction,
} from "@/lib/permissions";
import { useAuthority } from "@/lib/permissions/authority-context";

export type CanCheck = {
  (permission: GlobalAction): boolean;
  (
    permission: UnscopedViewAction,
    user?: { department: Department | null },
  ): boolean;
  (
    permission: Exclude<UserScopedAction, UnscopedViewAction>,
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
      permission: UnscopedViewAction;
      context?: { department: Department | null };
    })
  | (CanComponentProps & {
      permission: Exclude<UserScopedAction, UnscopedViewAction>;
      context: { department: Department | null };
    })
  | (CanComponentProps & {
      permission: GlobalAction;
      context?: never;
    })
  | (CanComponentProps & {
      permission: GroupScopedAction;
      context: { isMember: boolean };
    });

export function useCan(): CanCheck;
export function useCan(permission: GlobalAction): boolean;
export function useCan(
  permission: UnscopedViewAction,
  user?: { department: Department | null },
): boolean;
export function useCan(
  permission: Exclude<UserScopedAction, UnscopedViewAction>,
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

      if (isUserScopedAction(action)) {
        const scope: UserScope = {
          targetDepartment:
            checkResource !== undefined
              ? (checkResource.department ?? null)
              : isUnscopedViewAction(action)
                ? undefined
                : null,
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

  if (isUnscopedViewAction(permission)) {
    return check(
      permission,
      resource as { department: Department | null } | undefined,
    );
  }

  if (isUserScopedAction(permission)) {
    return check(permission, resource as { department: Department | null });
  }

  if (isGroupScopedAction(permission)) {
    return check(permission, resource as { isMember: boolean });
  }

  return false;
}

export function Can(props: CanProps) {
  const hidable = useContext(HidableGroupContext);
  const id = useId();
  const check = useCan();

  let granted: boolean;
  if (isGlobalAction(props.permission)) {
    granted = check(props.permission);
  } else if (isUnscopedViewAction(props.permission)) {
    granted = check(
      props.permission,
      props.context as { department: Department | null } | undefined,
    );
  } else if (isUserScopedAction(props.permission)) {
    granted = check(
      props.permission,
      props.context as { department: Department | null },
    );
  } else if (isGroupScopedAction(props.permission)) {
    granted = check(props.permission, props.context as { isMember: boolean });
  } else {
    granted = false;
  }

  useLayoutEffect(() => {
    if (!hidable) return;
    hidable.report(id, granted);
    return () => hidable.report(id, false);
  }, [hidable, id, granted]);

  return granted ? props.children : null;
}
