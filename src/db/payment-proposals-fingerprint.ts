import { createHash } from "node:crypto";
import type { MembershipPaymentCycleWithUser } from "./membership-payments";

/**
 * Stable content fingerprint of a proposal set, used to detect when the finance
 * digest would repeat an email that was already sent. Two digests hash to the
 * same value iff they render the same visible rows (member, due date, amount).
 * Order-independent — the input is sorted by its canonical line — so a
 * reshuffled query result doesn't count as "changed".
 *
 * Deliberately excludes the internal proposal id: it never appears in the email,
 * so a proposal recreated with the same member/date/amount (new id) must still
 * count as identical content and stay deduplicated within the weekly window.
 *
 * Kept free of DB imports so it stays a pure, independently testable helper.
 */
export function paymentProposalsFingerprint(
  proposals: Pick<
    MembershipPaymentCycleWithUser,
    "userName" | "activationDate" | "amount"
  >[],
): string {
  const canonical = proposals
    .map((p) => `${p.userName}|${p.activationDate}|${p.amount}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}
