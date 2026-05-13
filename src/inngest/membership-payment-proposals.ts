import {
  batchCreateProposedPayments,
  getMembersNeedingProposal,
} from "@/db/membership-payments";
import { inngest } from "@/lib/inngest";

export const membershipPaymentProposalsCron = inngest.createFunction(
  {
    id: "membership-payment-proposals",
    name: "Membership Payment Proposals (Daily)",
    triggers: [{ cron: "0 9 * * *" }],
  },
  async ({ step }) => {
    return step.run("check-and-propose", async () => {
      const members = await getMembersNeedingProposal();
      const proposed = await batchCreateProposedPayments(members);
      return { proposed, eligible: members.length };
    });
  },
);
