import { env } from "@/env";

export const MAINTENANCE_BYPASS_COOKIE = "maintenance_bypass";

export function maintenanceBypassSecret() {
  return `${env.BETTER_AUTH_SECRET}:maintenance`;
}
