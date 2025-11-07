"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";
import { stepAddressDataSchema } from "../onboarding-validation";

export const completeOnboardingAddressStep = actionClient
  .inputSchema(stepAddressDataSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { user } = ctx;

    if (!user) {
      redirect("/auth");
    }

    await db
      .update(userTable)
      .set({
        street: parsedInput.street,
        city: parsedInput.city,
        state: parsedInput.state,
        zip: parsedInput.zip,
        country: parsedInput.country,
      })
      .where(eq(userTable.id, user.id));

    return { success: true };
  });

