"use server";

import { z } from "zod";
import db from "@/db";
import { createOrReuseMembershipPayment } from "@/db/membership";
import { MembershipPaymentReadyEmail } from "@/emails/membership-payment-ready";
import { actionClient } from "@/lib/action-client";
import {
  getMembershipViewState,
  isProfileOnboardingComplete,
} from "@/lib/membership-status";
import { can } from "@/lib/permissions/server";
import { resend } from "@/lib/resend";

export const completeUserOnboardingAction = actionClient
  .inputSchema(z.object({ userId: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    if (!(await can("users.complete_onboarding"))) {
      throw new Error("You are not authorized to complete user onboarding.");
    }

    const targetUser = await db.query.user.findFirst({
      where: (users, { eq }) => eq(users.id, parsedInput.userId),
      with: {
        membershipPayment: true,
      },
    });

    if (!targetUser) {
      throw new Error("User not found.");
    }

    if (!isProfileOnboardingComplete(targetUser)) {
      throw new Error("The user has not completed their profile onboarding.");
    }

    const membershipState = getMembershipViewState(
      targetUser,
      targetUser.membershipPayment,
    );

    if (membershipState === "full_member") {
      throw new Error("This user is already a full member.");
    }

    if (targetUser.membershipPayment) {
      return { alreadyCompleted: true };
    }

    await createOrReuseMembershipPayment(targetUser.id);

    await resend.emails.send({
      from: "START Berlin <notifications@cockpit.start-berlin.com>",
      to: targetUser.email,
      subject: "Finalize your START Berlin membership",
      react: MembershipPaymentReadyEmail({
        firstName: targetUser.firstName,
      }),
    });

    return { alreadyCompleted: false };
  });
