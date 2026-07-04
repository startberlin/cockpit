import { createHash } from "node:crypto";
import type { MembershipPaymentCycleWithUser } from "./membership-payments";

/**
 * Stable content fingerprint of a proposal set, used to detect when the finance
 * digest would repeat an email that was already sent. Two digests hash to the
 * same value iff they cover the same proposals with the same visible data
 * (member, due date, amount). Order-independent — the input is sorted by its
 * canonical line — so a reshuffled query result doesn't count as "changed".
 *
 * Kept free of DB imports so it stays a pure, independently testable helper.
 */
export function paymentProposalsFingerprint(
  proposals: Pick<
    MembershipPaymentCycleWithUser,
    "id" | "userName" | "activationDate" | "amount"
  >[],
): string {
  const canonical = proposals
    .map((p) => `${p.id}|${p.userName}|${p.activationDate}|${p.amount}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}
