"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";

import type { RoleList } from ".";

const RolesContext = createContext<RoleList>([]);

export function RolesProvider({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles: RoleList;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <RolesContext.Provider value={roles}>{children}</RolesContext.Provider>
    </QueryClientProvider>
  );
}

export function useRoles(): RoleList {
  return useContext(RolesContext);
}
