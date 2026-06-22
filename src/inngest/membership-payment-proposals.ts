import {
  batchCreateProposedPayments,
  countProposalsBecomingVisibleToday,
  getMembersNeedingProposal,
} from "@/db/membership-payments";
import { env } from "@/env";
import { events, inngest } from "@/lib/inngest";

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

    // Proposals created with a future activation date (renewals, imported
    // members covered through a paid-through date) are invisible to the finance
    // digest until their activation date arrives. Nothing fires an event at
    // that moment, so detect the ones crossing into visibility today and
    // re-trigger the digest for them as well.
    const becameVisible = await step.run("check-newly-visible", () =>
      countProposalsBecomingVisibleToday(),
    );

    if (result.proposed > 0 || becameVisible > 0) {
      await step.sendEvent("fire-finance-digest", {
        name: events.paymentProposalCreated.name,
        data: { count: result.proposed + becameVisible },
      });
    }

    if (env.BETTERSTACK_HEARTBEAT_URL_PAYMENT_PROPOSALS) {
      await step.run("send-heartbeat", async () => {
        await fetch(env.BETTERSTACK_HEARTBEAT_URL_PAYMENT_PROPOSALS as string);
      });
    }

    return result;
  },
);
