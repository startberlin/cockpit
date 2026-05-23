import { PostHog } from "posthog-node";
import { env } from "@/env";

const token = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
if (!token) {
  console.warn(
    "PostHog disabled: NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set",
  );
}

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  if (!token) return null;
  if (!posthogClient) {
    posthogClient = new PostHog(token, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}
