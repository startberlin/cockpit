"use server";

import { env } from "@/env";
import { actionClient } from "@/lib/action-client";
import { slack } from "@/lib/slack";

export const getSlackStatusAction = actionClient.action(async ({ ctx }) => {
  if (env.DISABLE_SLACK) {
    return { exists: false };
  }

  const email = ctx.user.email;

  const res = await slack.users.lookupByEmail({
    email,
  });

  if (!res.ok) {
    if (res.error === "users_not_found") {
      return { exists: false };
    }

    throw new Error(res.error ?? "Slack API error");
  }

  return {
    exists: true,
  };
});
