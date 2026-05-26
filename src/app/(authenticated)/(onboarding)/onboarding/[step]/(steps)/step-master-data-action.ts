"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";
import { auth } from "@/lib/auth";
import { track } from "@/lib/posthog-server";
import { stepMasterDataSchema } from "../onboarding-validation";

export const completeOnboardingMasterDataStep = actionClient
  .inputSchema(stepMasterDataSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { user } = ctx;

    if (!user) {
      redirect("/auth");
    }

    await db
      .update(userTable)
      .set({
        personalEmail: parsedInput.personalEmail,
        phone: parsedInput.phone,
        birthDate: parsedInput.birthDate,
      })
      .where(eq(userTable.id, user.id));

    // Refresh the signed cookie cache so the onboarding gate in the app
    // layout sees the updated profile fields on the next request instead
    // of bouncing the user back here.
    await auth.api.getSession({
      headers: await headers(),
      query: { disableCookieCache: true },
    });

    after(() =>
      track({
        distinctId: ctx.user.id,
        event: "onboarding_master_data_submitted",
        properties: {
          had_personal_email: Boolean(parsedInput.personalEmail),
          had_phone: Boolean(parsedInput.phone),
          had_birth_date: Boolean(parsedInput.birthDate),
        },
      }),
    );

    return { success: true };
  });
