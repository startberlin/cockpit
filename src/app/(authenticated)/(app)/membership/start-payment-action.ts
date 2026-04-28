"use server";

import {
  getMembershipPaymentByUserId,
  markMembershipCheckoutStarted,
  newMembershipSessionId,
} from "@/db/membership";
import { env } from "@/env";
import { actionClient } from "@/lib/action-client";
import { createMembershipFlow } from "@/lib/gocardless/membership-flow";
import { reconcileMembershipPaymentForUser } from "@/lib/gocardless/membership-reconciliation";
import { getMembershipViewState } from "@/lib/membership-status";

export const startMembershipPaymentAction = actionClient.action(
  async ({ ctx }) => {
    const payment = await getMembershipPaymentByUserId(ctx.user.id);
    const membershipState = getMembershipViewState(ctx.user, payment);

    if (membershipState === "profile_onboarding") {
      throw new Error(
        "An admin needs to complete your onboarding before you can set up payment.",
      );
    }

    if (membershipState === "full_member") {
      return { hostedUrl: "/membership" };
    }

    if (!payment) {
      throw new Error(
        "An admin needs to complete your onboarding before you can set up payment.",
      );
    }

    let existingBillingRequestId = payment.gocardlessBillingRequestId;

    if (
      payment.gocardlessBillingRequestId ||
      payment.gocardlessBillingRequestFlowId ||
      payment.gocardlessMandateId
    ) {
      const reconciliation = await reconcileMembershipPaymentForUser({
        userId: ctx.user.id,
      });

      if (
        reconciliation.status === "activated" ||
        reconciliation.status === "already_active"
      ) {
        return { hostedUrl: reconciliation.hostedRedirect };
      }

      if (reconciliation.status === "failed") {
        existingBillingRequestId = null;
      }
    }

    const localSessionId = newMembershipSessionId();
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
      existingCustomerId: payment.gocardlessCustomerId,
      existingBillingRequestId,
    });

    await markMembershipCheckoutStarted({
      userId: ctx.user.id,
      gocardlessCustomerId: flow.customerId,
      gocardlessBillingRequestId: flow.billingRequestId,
      gocardlessBillingRequestFlowId: flow.billingRequestFlowId,
    });

    return { hostedUrl: flow.hostedUrl };
  },
);
