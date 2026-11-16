import "server-only";

import { inngest } from "@/lib/inngest";
import { isResendConfigured } from "../lib/resend";
import { syncAudience } from "../lib/sync-audience";

export const syncNewsletterAudienceCron = inngest.createFunction(
  {
    id: "newsletter-sync-audience-cron",
    name: "Sync newsletter audience from Resend",
    triggers: [{ cron: "TZ=Europe/Berlin 0 5 * * *" }],
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    if (!isResendConfigured()) return { skipped: "Resend is not configured" };
    return step.run("sync-audience", syncAudience);
  },
);
