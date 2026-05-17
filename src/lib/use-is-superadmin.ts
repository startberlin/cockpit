"use client";

import { authClient } from "./auth-client";

export function useIsSuperAdmin() {
  const { data } = authClient.useSession();
  return data?.user?.role === "admin";
}
