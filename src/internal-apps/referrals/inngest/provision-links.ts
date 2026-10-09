import "server-only";

import db from "@/db";
import { env } from "@/env";
import { events, inngest } from "@/lib/inngest";
import campaignConfig from "../../../../config/referrals/batch11-fall2026.json";
import { referralsStore } from "../db/server";
import {
  setupReferralCampaign,
  shouldInitializeReferralCampaign,
} from "../lib/setup";

export const provisionReferralLinks = inngest.createFunction(
  {
    id: "referrals-provision-links",
    name: "Provision personal referral links",
    triggers: [
      { cron: "TZ=Europe/Berlin 15 3 * * *" },
      { event: events.userSystemGroupsSync },
      { event: events.cockpitUserUpdated },
    ],
    concurrency: { limit: 1 },
  },
  async ({ event, step }) => {
    if (
      shouldInitializeReferralCampaign({
        eventName: event.name,
        environment: process.env.VERCEL_ENV,
        cockpitUrl: env.NEXT_PUBLIC_COCKPIT_URL,
      })
    ) {
      return step.run("initialize-production-campaign", () =>
        setupReferralCampaign(db, campaignConfig, {
          apiKey: env.TALLY_API_KEY,
          cockpitUrl: env.NEXT_PUBLIC_COCKPIT_URL,
          signingSecret: env.TALLY_REFERRALS_WEBHOOK_SECRET,
          connectWebhook: true,
        }),
      );
    }
    return step.run("provision-active-members", () =>
      referralsStore.provisionMembers(),
    );
  },
);
