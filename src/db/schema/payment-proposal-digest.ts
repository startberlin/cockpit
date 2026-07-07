import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Append-only log of finance payment-proposal digests that were actually sent.
// The daily digest cron consults the most recent row to avoid emailing finance
// the exact same proposal set two days in a row: it only re-sends when the
// content changed or a week has elapsed since the last identical digest.
export const paymentProposalDigestLog = pgTable(
  "payment_proposal_digest_log",
  {
    id: text("id").primaryKey(),
    // Stable hash of the proposal set the digest covered (see
    // paymentProposalsFingerprint). Identical hash => identical email content.
    fingerprint: text("fingerprint").notNull(),
    proposalCount: integer("proposal_count").notNull(),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  (table) => [
    index("payment_proposal_digest_log_sent_at_idx").on(table.sentAt),
  ],
);

export type PaymentProposalDigestLog =
  typeof paymentProposalDigestLog.$inferSelect;
