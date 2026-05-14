"use server";

import { getClientSubscriptionToken } from "inngest/react";
import { getActiveLegalMembership } from "@/db/membership";
import { getCurrentUser } from "@/db/user";
import { membershipActivatedChannel } from "@/inngest/channels";
import { inngest } from "@/lib/inngest";

export async function getDocumentsSubscriptionToken() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthenticated");

  const membership = await getActiveLegalMembership(user.id);
  if (!membership || membership.status !== "processing") {
    throw new Error("No membership in processing state");
  }

  return getClientSubscriptionToken(inngest, {
    channel: membershipActivatedChannel(membership.id),
    topics: ["activated"],
  });
}
