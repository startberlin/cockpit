"use server";

import { env } from "@/env";
import { actionClient } from "@/lib/action-client";

const TALLY_WORKSPACE_IDS = [
  "wLDNPp", // General
  "npe1DB", // Community
  "31Wy9l", // Digital
  "wM1qEA", // Events
  "mJ1xOR", // Marketing
];

export const requestTallyInviteAction = actionClient.action(async ({ ctx }) => {
  if (!env.TALLY_API_KEY || !env.TALLY_ORGANIZATION_ID) {
    throw new Error("Tally is not configured");
  }

  const email = ctx.user.email;

  if (!email) {
    throw new Error("No email address on your account");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let res: Response;
  try {
    res = await fetch(
      `https://api.tally.so/organizations/${env.TALLY_ORGANIZATION_ID}/invites`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.TALLY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceIds: TALLY_WORKSPACE_IDS,
          emails: email,
        }),
      },
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok && res.status !== 204) {
    throw new Error("Could not send the Tally invite. Please try again.");
  }

  return { success: true };
});
