"use server";

import { getCurrentUser } from "@/db/user";
import { getPostHogClient } from "@/lib/posthog-server";

export async function checkMandateReadyAction(): Promise<boolean> {
  const user = await getCurrentUser();
  const mandateReady = !!user?.gocardlessMandateId;

  if (user) {
    getPostHogClient()?.capture({
      distinctId: user.id,
      event: "payment_mandate_returned",
      properties: { success: mandateReady },
    });

    if (mandateReady) {
      getPostHogClient()?.capture({
        distinctId: user.id,
        event: "payment_mandate_confirmed",
        properties: {},
      });
    }
  }

  return mandateReady;
}
