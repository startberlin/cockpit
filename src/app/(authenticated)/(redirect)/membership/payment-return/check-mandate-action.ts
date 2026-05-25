"use server";

import { getCurrentUser } from "@/db/user";
import { getPostHogClient } from "@/lib/posthog-server";

export async function checkMandateReadyAction(): Promise<boolean> {
  const user = await getCurrentUser();
  const mandateReady = !!user?.gocardlessMandateId;
  const posthog = getPostHogClient();

  if (user && posthog) {
    try {
      posthog.capture({
        distinctId: user.id,
        event: "payment_mandate_returned",
        properties: { success: mandateReady },
      });

      if (mandateReady) {
        posthog.capture({
          distinctId: user.id,
          event: "payment_mandate_confirmed",
          properties: {},
        });
      }
    } catch (err) {
      console.error(
        "[analytics] Failed to capture payment_mandate event:",
        err,
      );
    }
  }

  return mandateReady;
}
