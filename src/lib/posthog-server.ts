import { PostHog } from "posthog-node";
import { env } from "@/env";

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog {
  if (!posthogClient) {
    const token = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    if (!token) {
      throw new Error("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set");
    }
    posthogClient = new PostHog(token, {
      host: "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}
