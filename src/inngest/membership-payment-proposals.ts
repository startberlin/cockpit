import {
  createProposedPayment,
  getLastActivationDate,
  getMembersNeedingProposal,
  hasInFlightPayment,
  isMemberCovered,
} from "@/db/membership-payments";
import { inngest } from "@/lib/inngest";

export const membershipPaymentProposalsCron = inngest.createFunction(
  {
    id: "membership-payment-proposals",
    name: "Membership Payment Proposals (Daily)",
    triggers: [{ cron: "0 9 * * *" }],
  },
  async ({ step }) => {
    const results = await step.run("check-and-propose", async () => {
      const members = await getMembersNeedingProposal();
      const proposed: string[] = [];
      const skipped: string[] = [];

      for (const member of members) {
        const [covered, inFlight] = await Promise.all([
          isMemberCovered(member.id),
          hasInFlightPayment(member.id),
        ]);

        if (covered || inFlight) {
          skipped.push(member.id);
          continue;
        }

        const lastDate = await getLastActivationDate(member.id);
        let activationDate: string;

        if (lastDate) {
          // Subsequent cycle: anchor = previous activationDate + 1 year
          const d = new Date(lastDate);
          d.setFullYear(d.getFullYear() + 1);
          activationDate = d.toISOString().slice(0, 10);
        } else {
          // First cycle: today
          activationDate = new Date().toISOString().slice(0, 10);
        }

        await createProposedPayment(member.id, activationDate);
        proposed.push(member.id);
      }

      return { proposed, skipped };
    });

    return results;
  },
);
