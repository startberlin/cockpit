"use server";

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import db from "@/db";
import { user } from "@/db/schema/auth";
import { env } from "@/env";
import { actionClient } from "@/lib/action-client";
import { createMembershipFlow } from "@/lib/gocardless/membership-flow";
import { getStructuredMembershipState } from "@/lib/membership-status";

export const startMembershipPaymentAction = actionClient.action(
  async ({ ctx }) => {
    const membershipState = getStructuredMembershipState(ctx.user);

    if (!membershipState.paymentSetupAllowed) {
      throw new Error(
        "An admin needs to complete your onboarding before you can set up payment.",
      );
    }

    if (membershipState.payment === "active") {
      return { hostedUrl: "/membership" };
    }

    // Stable per-user session ID so concurrent or repeated calls reuse the
    // same GoCardless billing request flow instead of creating new ones.
    const localSessionId = `mps_${createHash("sha256").update(`payment-setup:${ctx.user.id}`).digest("hex").slice(0, 16)}`;
    const returnUrl = `${env.NEXT_PUBLIC_COCKPIT_URL}/membership/payment-return`;
    const exitUrl = `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`;

    const flow = await createMembershipFlow({
      userId: ctx.user.id,
      email: ctx.user.email,
      firstName: ctx.user.firstName,
      lastName: ctx.user.lastName,
      phone: ctx.user.phone,
      address: {
        street: ctx.user.street,
        city: ctx.user.city,
        state: ctx.user.state,
        zip: ctx.user.zip,
        country: ctx.user.country,
      },
      returnUrl,
      exitUrl,
      localSessionId,
      existingCustomerId: ctx.user.gocardlessCustomerId,
    });

    // Immediately persist the GoCardless customer ID so retries reuse the same customer.
    if (flow.customerId && !ctx.user.gocardlessCustomerId) {
      await db
        .update(user)
        .set({ gocardlessCustomerId: flow.customerId })
        .where(eq(user.id, ctx.user.id));
    }

    return { hostedUrl: flow.hostedUrl };
  },
);
