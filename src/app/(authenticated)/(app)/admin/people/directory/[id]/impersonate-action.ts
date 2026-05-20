"use server";

import { generateId } from "@better-auth/core/utils/id";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import db from "@/db";
import { session as sessionTable, user as userTable } from "@/db/schema";
import { env } from "@/env";
import { actionClient } from "@/lib/action-client";
import { auth } from "@/lib/auth";
import { signCookieValue } from "@/lib/auth-cookies";
import { can } from "@/lib/permissions/server";

const SESSION_COOKIE = "better-auth.session_token";
const ADMIN_SESSION_COOKIE = "better-auth.admin_session";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

export const impersonateAction = actionClient
  .inputSchema(z.object({ userId: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    if (!(await can("users.impersonate"))) {
      throw new Error("You are not authorized to impersonate users.");
    }

    const [targetUser] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, parsedInput.userId))
      .limit(1);

    if (!targetUser) {
      throw new Error("User not found.");
    }

    const currentSession = await auth.api.getSession({
      headers: await headers(),
    });
    if (!currentSession) throw new Error("No active session.");

    const token = generateId(32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(sessionTable).values({
      id: generateId(),
      token,
      userId: targetUser.id,
      expiresAt,
      impersonatedBy: currentSession.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    });

    const secret = env.BETTER_AUTH_SECRET;
    const cookieStore = await cookies();

    cookieStore.set(
      ADMIN_SESSION_COOKIE,
      await signCookieValue(currentSession.session.token, secret),
      { ...COOKIE_OPTS, maxAge: 24 * 60 * 60 },
    );

    cookieStore.set(SESSION_COOKIE, await signCookieValue(token, secret), {
      ...COOKIE_OPTS,
      maxAge: 24 * 60 * 60,
    });
  });
