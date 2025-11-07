"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";
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
      })
      .where(eq(userTable.id, user.id));

    return { success: true };
  });
