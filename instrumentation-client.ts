import posthog from "posthog-js";
import { env } from "@/env";
import { BEFORE_ROUTER_POPSTATE } from "@/internal-apps/jobboard/lib/navigation-intent";

// Run before the router can unmount an editor with unsaved changes.
window.addEventListener(
  "popstate",
  (event) => {
    if (
      !window.dispatchEvent(
        new Event(BEFORE_ROUTER_POPSTATE, { cancelable: true }),
      )
    )
      event.stopImmediatePropagation();
  },
  true,
);

const token = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
if (token) {
  posthog.init(token, {
    api_host: "/ingest",
    ui_host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  });
} else {
  console.warn(
    "PostHog disabled: NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set",
  );
}
