import {
  getFinanceAdminUsers,
  getPositionAssignments,
  type PositionHolder,
} from "@/db/authority";
import { getProposedPayments } from "@/db/membership-payments";
import {
  getLastPaymentDigestSend,
  recordPaymentDigestSend,
} from "@/db/payment-proposal-digest";
import { paymentProposalsFingerprint } from "@/db/payment-proposals-fingerprint";
import PaymentProposalsDigestEmail from "@/emails/membership/payment/payment-proposals-digest";
import { sendEmail } from "@/lib/email";
import { inngest } from "@/lib/inngest";

// Re-send an unchanged digest at most this often. Below the threshold, a digest
// covering the exact same proposals as the previous send is skipped so finance
// doesn't get the identical email day after day; once a week has passed the same
// proposals are surfaced again as a reminder ("at least once per week"). A small
// margin below 7 days absorbs cron/timestamp jitter so the weekly re-send fires
// on the 7th daily run rather than slipping to the 8th.
const RESEND_UNCHANGED_AFTER_MS = 7 * 24 * 60 * 60 * 1000 - 6 * 60 * 60 * 1000;

export const financePaymentProposalsDigest = inngest.createFunction(
  {
    id: "finance-payment-proposals-digest",
    name: "Finance Payment Proposals Digest",
    // Runs daily, shortly after the proposal-creation cron (09:00 Berlin). It
    // reads the current proposal set straight from the DB (the same query the
    // payments page uses) and emails finance whatever is awaiting review. A
    // fixed daily schedule keeps the digest in lockstep with the page and
    // removes any per-trigger asymmetry between how proposals come to exist
    // (reconfirmation, admission, renewal cron, …).
    //
    // It only includes proposals whose member has a GoCardless mandate — the
    // ones finance can actually charge. No-mandate proposals stay on the page
    // (with a "No mandate" badge) but are kept out of the email so an unfinished
    // mandate setup doesn't trigger a daily reminder forever.
    //
    // The cron fires every day, but a digest is only actually sent when its
    // content is new: each send is fingerprinted and logged, and a run whose
    // proposal set matches the last sent digest is skipped until a week has
    // passed (see RESEND_UNCHANGED_AFTER_MS). This keeps the reminder to "at
    // least once per week" without emailing finance the same list day after day.
    triggers: [{ cron: "TZ=Europe/Berlin 15 9 * * *" }],
  },
  async ({ step }) => {
    const proposals = await step.run("fetch-proposals", () =>
      getProposedPayments({ requireMandate: true }),
    );

    if (proposals.length === 0) {
      return { outcome: "no_proposals" };
    }

    // Skip if this exact proposal set was already emailed recently. We compare
    // against the last recorded send: send when there's no prior digest, when
    // the content changed, or when a week has elapsed since an identical one.
    const fingerprint = paymentProposalsFingerprint(proposals);
    const decision = await step.run("evaluate-dedup", async () => {
      const lastSend = await getLastPaymentDigestSend();
      if (!lastSend) return { send: true, reason: "no_prior_send" as const };
      if (lastSend.fingerprint !== fingerprint) {
        return { send: true, reason: "content_changed" as const };
      }
      const elapsedMs = Date.now() - lastSend.sentAt.getTime();
      if (elapsedMs >= RESEND_UNCHANGED_AFTER_MS) {
        return { send: true, reason: "weekly_refresh" as const };
      }
      return { send: false, reason: "duplicate_within_window" as const };
    });

    if (!decision.send) {
      return {
        outcome: "skipped_duplicate",
        reason: decision.reason,
        proposalCount: proposals.length,
      };
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

    // Record the send only after the emails went out, so a failure before this
    // point doesn't suppress a retry, and so the weekly-refresh / duplicate
    // window is anchored to a digest that actually reached finance.
    await step.run("record-digest-send", () =>
      recordPaymentDigestSend(fingerprint, proposals.length),
    );

    return {
      outcome: "sent",
      reason: decision.reason,
      recipientCount: recipients.length,
      proposalCount: proposals.length,
    };
  },
);
