"use server";

import { getClientSubscriptionToken } from "inngest/react";
import { mandateActivatedChannel } from "@/inngest/channels";
import { inngest } from "@/lib/inngest";
import { getCurrentUser } from "@/db/user";

export async function getMandateSubscriptionToken() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthenticated");

  return getClientSubscriptionToken(inngest, {
    channel: mandateActivatedChannel(user.id),
    topics: ["activated"],
  });
}
