"use server";

import { after } from "next/server";
import { getCurrentUser } from "@/db/user";
import { reconcileMembershipPaymentByBillingRequestId } from "@/lib/gocardless/membership-reconciliation";
import { track } from "@/lib/posthog-server";

export async function checkMandateReadyAction(): Promise<boolean> {
  const user = await getCurrentUser();

  if (!user) return false;

  let mandateReady = !!user.gocardlessMandateId;

  // If the webhook hasn't arrived yet, reconcile directly via the GC API
  // using the billing request ID stored when the user started the flow.
  if (!mandateReady && user.gocardlessBillingRequestId) {
    try {
      const result = await reconcileMembershipPaymentByBillingRequestId(
        user.gocardlessBillingRequestId,
      );
      mandateReady =
        result.status === "activated" || result.status === "already_active";
    } catch {
      // GC API error — keep polling
    }
  }

  after(() => {
    track({
      distinctId: user.id,
      event: "payment_mandate_returned",
      properties: { success: mandateReady },
    });
    if (mandateReady) {
      track({
        distinctId: user.id,
        event: "payment_mandate_confirmed",
      });
    }
  });

  return mandateReady;
}
