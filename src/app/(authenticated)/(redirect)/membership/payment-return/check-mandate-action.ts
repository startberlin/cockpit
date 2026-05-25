"use server";

import { after } from "next/server";
import { getCurrentUser } from "@/db/user";
import { track } from "@/lib/posthog-server";

export async function checkMandateReadyAction(): Promise<boolean> {
  const user = await getCurrentUser();
  const mandateReady = !!user?.gocardlessMandateId;

  if (user) {
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
          properties: {},
        });
      }
    });
  }

  return mandateReady;
}
