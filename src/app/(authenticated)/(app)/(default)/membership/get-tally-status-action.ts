"use server";

import { env } from "@/env";
import { actionClient } from "@/lib/action-client";

export const getTallyStatusAction = actionClient.action(async ({ ctx }) => {
  if (!env.TALLY_API_KEY || !env.TALLY_ORGANIZATION_ID) {
    return { isMember: false };
  }

  const email = ctx.user.email;

  if (!email) {
    return { isMember: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let res: Response;
  try {
    res = await fetch(
      `https://api.tally.so/organizations/${env.TALLY_ORGANIZATION_ID}/users`,
      {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.TALLY_API_KEY}`,
        },
      },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return { isMember: false };
    }
    throw new Error("Could not check Tally membership status");
  }

  const data = await res.json();
  const users: Array<{ email: string }> = Array.isArray(data)
    ? data
    : (data.users ?? data.data ?? []);

  const normalizedEmail = email.trim().toLowerCase();

  return {
    isMember: users.some(
      (u) => u.email.trim().toLowerCase() === normalizedEmail,
    ),
  };
});
