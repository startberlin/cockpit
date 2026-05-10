"use client";

import { createContext, useContext } from "react";
import type { UserAuthority } from ".";

const AuthorityContext = createContext<UserAuthority | null>(null);

export function AuthorityProvider({
  authority,
  children,
}: {
  authority: UserAuthority;
  children: React.ReactNode;
}) {
  return (
    <AuthorityContext.Provider value={authority}>
      {children}
    </AuthorityContext.Provider>
  );
}

export function useAuthority(): UserAuthority | null {
  return useContext(AuthorityContext);
}
