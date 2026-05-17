import { env } from "@/env";

export const MAINTENANCE_BYPASS_COOKIE = "maintenance_bypass";

export function maintenanceBypassSecret() {
  return `${env.BETTER_AUTH_SECRET}:maintenance`;
}

/** Returns a safe internal path from any redirect param, falling back to "/". */
export function safeRedirectPath(
  raw: string | FormDataEntryValue | null | undefined,
): string {
  const p = typeof raw === "string" ? raw : null;
  if (!p?.startsWith("/") || p.startsWith("//")) return "/";
  return p;
}
