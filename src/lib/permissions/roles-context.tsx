"use client";

import { createContext, useContext } from "react";

import type { RoleList } from ".";

const RolesContext = createContext<RoleList>([]);

export function RolesProvider({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles: RoleList;
}) {
  return (
    <RolesContext.Provider value={roles}>{children}</RolesContext.Provider>
  );
}

export function useRoles(): RoleList {
  return useContext(RolesContext);
}
