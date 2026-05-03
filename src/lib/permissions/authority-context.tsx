"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import type { UserAuthority } from ".";

const AuthorityContext = createContext<UserAuthority | null>(null);

export function AuthorityProvider({
  authority,
  children,
}: {
  authority: UserAuthority;
  children: React.ReactNode;
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
      <AuthorityContext.Provider value={authority}>
        {children}
      </AuthorityContext.Provider>
    </QueryClientProvider>
  );
}

export function useAuthority(): UserAuthority | null {
  return useContext(AuthorityContext);
}
