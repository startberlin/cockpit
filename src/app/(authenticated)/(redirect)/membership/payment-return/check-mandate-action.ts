"use server";

import { after } from "next/server";
import { getCurrentUser } from "@/db/user";
import { reconcileMembershipPaymentByBillingRequestId } from "@/lib/gocardless/membership-reconciliation";
import { track } from "@/lib/posthog-server";

export async function checkMandateReadyAction(
  billingRequestId?: string,
): Promise<boolean> {
  const user = await getCurrentUser();

  if (!user) return false;

  let mandateReady = !!user.gocardlessMandateId;

  // If the webhook hasn't arrived yet but we have the billing request ID from
  // the GC redirect URL, reconcile directly with the GC API instead of waiting.
  if (!mandateReady && billingRequestId) {
    try {
      const result =
        await reconcileMembershipPaymentByBillingRequestId(billingRequestId);
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
