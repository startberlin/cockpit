"use server";

import { z } from "zod";
import db from "@/db";
import { MembershipPaymentReadyEmail } from "@/emails/membership-payment-ready";
import { actionClient } from "@/lib/action-client";
import { sendEmail } from "@/lib/email";
import { can } from "@/lib/permissions/server";
import { getOnboardingProgress } from "@/schema/onboarding-progress";

export const completeUserOnboardingAction = actionClient
  .inputSchema(z.object({ userId: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    const targetUser = await db.query.user.findFirst({
      where: (users, { eq }) => eq(users.id, parsedInput.userId),
    });

    if (!targetUser) {
      throw new Error("User not found.");
    }

    if (!(await can("user.complete_onboarding", targetUser))) {
      throw new Error("You are not authorized to complete user onboarding.");
    }

    if (getOnboardingProgress(targetUser) !== "completed") {
      throw new Error("The user has not completed their profile onboarding.");
    }

    if (targetUser.gocardlessMandateId) {
      throw new Error("This user is already a full member.");
    }

    await sendEmail({
      from: "START Berlin <notifications@cockpit.start-berlin.com>",
      to: targetUser.email,
      subject: "Finalize your START Berlin membership",
      react: MembershipPaymentReadyEmail({
        firstName: targetUser.firstName,
      }),
    });

    return { success: true };
  });
