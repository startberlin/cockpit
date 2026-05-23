"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

export function PostHogIdentify() {
  const session = authClient.useSession();
  const user = session.data?.user;

  useEffect(() => {
    if (user?.id) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.name,
      });
    }
  }, [user?.id, user?.email, user?.name]);

  return null;
}
