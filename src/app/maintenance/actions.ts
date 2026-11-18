"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import {
  createMaintenanceBypass,
  MAINTENANCE_BYPASS_COOKIE,
} from "@/lib/maintenance";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getSystemSettings } from "@/lib/system-settings";
import { isMaintenanceAdmin } from "./eligibility";

export async function grantMaintenanceBypassAction(formData: FormData) {
  const [session, settings] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getSystemSettings(),
  ]);
  if (
    !settings.maintenanceMode ||
    !session ||
    !(await isMaintenanceAdmin(session.user.id))
  )
    return;

  const redirectUrl = safeRedirectPath(formData.get("redirect"));

  const { expires, value } = await createMaintenanceBypass(
    session.session.id,
    env.BETTER_AUTH_SECRET,
  );
  const cookieStore = await cookies();

  cookieStore.set(MAINTENANCE_BYPASS_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });

  redirect(redirectUrl);
}
