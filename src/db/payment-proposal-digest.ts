import { newId } from "@/lib/id";
import db from ".";
import {
  type PaymentProposalDigestLog,
  paymentProposalDigestLog,
} from "./schema/payment-proposal-digest";

export type { PaymentProposalDigestLog };

/** The most recently sent finance payment-proposal digest, if any. */
export async function getLastPaymentDigestSend(): Promise<
  PaymentProposalDigestLog | undefined
> {
  return db.query.paymentProposalDigestLog.findFirst({
    orderBy: (t, { desc }) => [desc(t.sentAt)],
  });
}

/** Record that a digest covering `fingerprint` was just sent. */
export async function recordPaymentDigestSend(
  fingerprint: string,
  proposalCount: number,
): Promise<void> {
  await db.insert(paymentProposalDigestLog).values({
    id: newId("paymentProposalDigest"),
    fingerprint,
    proposalCount,
  });
}
