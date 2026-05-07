"use server";

import {
  createOrReuseMembershipPayment,
  getMembershipPaymentByUserId,
  markMembershipCheckoutStarted,
  newMembershipSessionId,
} from "@/db/membership";
import { env } from "@/env";
import { actionClient } from "@/lib/action-client";
import { createMembershipFlow } from "@/lib/gocardless/membership-flow";
import { reconcileMembershipPaymentForUser } from "@/lib/gocardless/membership-reconciliation";
import { getStructuredMembershipState } from "@/lib/membership-status";

export const startMembershipPaymentAction = actionClient.action(
  async ({ ctx }) => {
    let payment = await getMembershipPaymentByUserId(ctx.user.id);
    const membershipState = getStructuredMembershipState(ctx.user, payment);

    if (!membershipState.paymentSetupAllowed) {
      throw new Error(
        "An admin needs to complete your onboarding before you can set up payment.",
      );
    }

    if (membershipState.payment === "active") {
      return { hostedUrl: "/membership" };
    }

    if (!payment) {
      payment = await createOrReuseMembershipPayment(ctx.user.id);
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
