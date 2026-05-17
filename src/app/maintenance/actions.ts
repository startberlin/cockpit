"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  MAINTENANCE_BYPASS_COOKIE,
  maintenanceBypassSecret,
} from "@/lib/maintenance";
import { isMaintenanceAdmin } from "./eligibility";

function safePath(raw: FormDataEntryValue | null): string {
  const p = typeof raw === "string" ? raw : "/";
  if (!p.startsWith("/") || p.startsWith("//")) return "/";
  return p;
}

export async function grantMaintenanceBypassAction(formData: FormData) {
  if (!(await isMaintenanceAdmin())) return;

  const redirectUrl = safePath(formData.get("redirect"));

  const { set } = await cookies();

  set(MAINTENANCE_BYPASS_COOKIE, maintenanceBypassSecret(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
  });

  redirect(redirectUrl);
}
