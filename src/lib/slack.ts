import "server-only";

import { WebClient } from "@slack/web-api";
import { env } from "@/env";

/**
 * Slack is called from request-scoped code (server actions, route handlers), so
 * a hung call would hold a request open. Bound both the single request and the
 * retry budget instead of relying on the SDK defaults, which retry for minutes.
 */
export const slack = new WebClient(env.SLACK_BOT_TOKEN, {
  timeout: 8_000,
  retryConfig: {
    retries: 2,
    factor: 2,
    minTimeout: 200,
    maxTimeout: 2_000,
  },
});
