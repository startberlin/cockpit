import {
  getFinanceAdminUsers,
  getPositionAssignments,
  type PositionHolder,
} from "@/db/authority";
import { getProposedPayments } from "@/db/membership-payments";
import PaymentProposalsDigestEmail from "@/emails/membership/payment/payment-proposals-digest";
import { sendEmail } from "@/lib/email";
import { inngest } from "@/lib/inngest";

export const financePaymentProposalsDigest = inngest.createFunction(
  {
    id: "finance-payment-proposals-digest",
    name: "Finance Payment Proposals Digest",
    // Runs daily, shortly after the proposal-creation cron (09:00 Berlin). It
    // loads the exact same proposal set as the payments page
    // (getProposedPayments) and emails finance whenever anything is awaiting
    // review. Reading straight from the DB on a fixed schedule keeps the digest
    // in lockstep with the page — there is a single definition of "a proposal
    // is visible", and no per-trigger asymmetry between how proposals come to
    // exist (reconfirmation, admission, renewal cron, …).
    triggers: [{ cron: "TZ=Europe/Berlin 15 9 * * *" }],
  },
  async ({ step }) => {
    const proposals = await step.run("fetch-proposals", () =>
      getProposedPayments(),
    );

    if (proposals.length === 0) {
      return { outcome: "no_proposals" };
    }

    const recipients = await step.run("fetch-recipients", async () => {
      const positions = await getPositionAssignments();
      const financeAdmins = await getFinanceAdminUsers();

      const byUserId = new Map<
        string,
        PositionHolder & { receivingReason: string }
      >();
      if (positions.head_of_finance) {
        byUserId.set(positions.head_of_finance.userId, {
          ...positions.head_of_finance,
          receivingReason:
            "You're receiving this because you're the head of finance of START Berlin.",
        });
      }
      for (const admin of financeAdmins) {
        if (!byUserId.has(admin.userId)) {
          byUserId.set(admin.userId, {
            ...admin,
            receivingReason:
              "You're receiving this because you're a finance administrator at START Berlin.",
          });
        }
      }

      return [...byUserId.values()].filter((r) => r.email);
    });

    if (recipients.length === 0) {
      return { outcome: "no_recipients" };
    }

    // One step per recipient so retries only re-send to the recipient that
    // failed, not to recipients who already received the digest.
    for (const r of recipients) {
      await step.run(`send-digest-email-${r.userId}`, async () => {
        await sendEmail({
          from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
          to: r.email!,
          subject: `${proposals.length} membership payment proposal${proposals.length === 1 ? "" : "s"} awaiting review`,
          react: PaymentProposalsDigestEmail({
            firstName: r.firstName,
            proposals,
            receivingReason: r.receivingReason,
          }),
        });
      });
    }

    return {
      outcome: "sent",
      recipientCount: recipients.length,
      proposalCount: proposals.length,
    };
  },
);
