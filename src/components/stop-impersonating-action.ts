"use server";

import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { createSafeActionClient } from "next-safe-action";
import db from "@/db";
import { session as sessionTable } from "@/db/schema";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import { signCookieValue, verifySignedCookie } from "@/lib/auth-cookies";

const SESSION_COOKIE = "better-auth.session_token";
const ADMIN_SESSION_COOKIE = "better-auth.admin_session";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

// Use a plain action client here — no user redirect needed since the
// impersonated user might not have the normal permissions/routes.
const baseClient = createSafeActionClient({
  handleServerError: (error) => {
    console.error(error);
    return "Something went wrong. Please try again.";
  },
});

export const stopImpersonatingAction = baseClient.action(async () => {
  const currentSession = await auth.api.getSession({
    headers: await headers(),
  });
  if (!currentSession) throw new Error("No active session.");
  if (!currentSession.session.impersonatedBy)
    throw new Error("Not impersonating.");

  const cookieStore = await cookies();
  const secret = env.BETTER_AUTH_SECRET;

  const adminCookieRaw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!adminCookieRaw) throw new Error("Admin session cookie missing.");

  const originalToken = await verifySignedCookie(adminCookieRaw, secret);
  if (!originalToken) throw new Error("Invalid admin session cookie.");

  const [originalSession] = await db
    .select()
    .from(sessionTable)
    .where(eq(sessionTable.token, originalToken))
    .limit(1);

  if (!originalSession || originalSession.expiresAt < new Date()) {
    throw new Error("Original session expired. Please sign in again.");
  }

  await db
    .delete(sessionTable)
    .where(eq(sessionTable.token, currentSession.session.token));

  const remainingSecs = Math.floor(
    (originalSession.expiresAt.getTime() - Date.now()) / 1000,
  );

  cookieStore.set(
    SESSION_COOKIE,
    await signCookieValue(originalToken, secret),
    { ...COOKIE_OPTS, maxAge: remainingSecs },
  );

  cookieStore.set(ADMIN_SESSION_COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
});
