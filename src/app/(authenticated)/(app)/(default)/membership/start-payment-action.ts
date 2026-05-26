"use server";

import { and, eq, isNull } from "drizzle-orm";
import { after } from "next/server";
import db from "@/db";
import { newMembershipSessionId } from "@/db/membership";
import { user } from "@/db/schema/auth";
import { env } from "@/env";
import { actionClient } from "@/lib/action-client";
import { createMembershipFlow } from "@/lib/gocardless/membership-flow";
import { getStructuredMembershipState } from "@/lib/membership-status";
import { track } from "@/lib/posthog-server";

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

    // Reuse the stored setup session so concurrent/repeated calls during one
    // setup attempt hit the same GoCardless billing request. Use a conditional
    // UPDATE (WHERE session IS NULL) so concurrent calls don't each generate a
    // different session — the loser re-reads and adopts the winner's session,
    // producing the same idempotency key and therefore the same GC customer.
    let localSessionId = ctx.user.gocardlessSetupSessionId;
    let existingCustomerId = ctx.user.gocardlessCustomerId;

    if (!localSessionId) {
      const candidate = newMembershipSessionId();
      await db
        .update(user)
        .set({ gocardlessSetupSessionId: candidate })
        .where(
          and(eq(user.id, ctx.user.id), isNull(user.gocardlessSetupSessionId)),
        );

      // Re-read: if a concurrent call stored its session first, adopt that one.
      const freshUser = await db.query.user.findFirst({
        where: eq(user.id, ctx.user.id),
        columns: { gocardlessSetupSessionId: true, gocardlessCustomerId: true },
      });
      localSessionId = freshUser?.gocardlessSetupSessionId ?? candidate;
      existingCustomerId =
        freshUser?.gocardlessCustomerId ?? existingCustomerId;
    }

    const returnUrl = `${env.NEXT_PUBLIC_COCKPIT_URL}/membership/payment-return`;
    const exitUrl = `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`;

    if (!ctx.user.email) {
      throw new Error("Your account email is no longer active.");
    }

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
      existingCustomerId,
    });

    // Store the billing request ID so the redirect page can reconcile
    // directly without waiting for the webhook.
    await db
      .update(user)
      .set({ gocardlessBillingRequestId: flow.billingRequestId })
      .where(eq(user.id, ctx.user.id));

    // Persist customer ID so retries reuse the same GC customer.
    if (flow.customerId && !existingCustomerId) {
      await db
        .update(user)
        .set({ gocardlessCustomerId: flow.customerId })
        .where(
          and(eq(user.id, ctx.user.id), isNull(user.gocardlessCustomerId)),
        );
    }

    after(() =>
      track({
        distinctId: ctx.user.id,
        event: "payment_setup_started",
      }),
    );

    return { hostedUrl: flow.hostedUrl };
  },
);
