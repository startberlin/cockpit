import {
  batchCreateProposedPayments,
  getMembersNeedingProposal,
} from "@/db/membership-payments";
import { env } from "@/env";
import { inngest } from "@/lib/inngest";

export const membershipPaymentProposalsCron = inngest.createFunction(
  {
    id: "membership-payment-proposals",
    name: "Membership Payment Proposals (Daily)",
    triggers: [{ cron: "TZ=Europe/Berlin 0 9 * * *" }],
  },
  async ({ step }) => {
    const result = await step.run("check-and-propose", async () => {
      const members = await getMembersNeedingProposal();
      const proposed = await batchCreateProposedPayments(members);
      return { proposed, eligible: members.length };
    });

    // The finance digest is its own daily cron (finance-payment-proposals-digest)
    // that reads the current proposal set directly, so this cron only needs to
    // create the due proposals — it does not notify anyone itself.

    if (env.BETTERSTACK_HEARTBEAT_URL_PAYMENT_PROPOSALS) {
      await step.run("send-heartbeat", async () => {
        await fetch(env.BETTERSTACK_HEARTBEAT_URL_PAYMENT_PROPOSALS as string);
      });
    }

    return result;
  },
);
