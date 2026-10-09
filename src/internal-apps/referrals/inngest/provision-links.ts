import "server-only";

import { events, inngest } from "@/lib/inngest";
import { referralsStore } from "../db/server";

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
  async ({ step }) =>
    step.run("provision-active-members", () =>
      referralsStore.provisionMembers(),
    ),
);
