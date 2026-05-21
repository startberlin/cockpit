import type { UserStatus } from "@/db/schema/auth";
import type { LegalMembershipStatus } from "@/db/schema/legal-membership";
import type { StructuredMembershipState } from "@/lib/membership-status";

export type MembershipNoticeType =
  | "alumni"
  | "application_pending"
  | "membership_reconfirmation_pending"
  | "manual_followup"
  | "payment_cancelled"
  | "payment_not_started"
  | null;

export function deriveMembershipNotice(
  membershipState: Pick<
    StructuredMembershipState,
    "payment" | "mandateCancelled"
  >,
  legalMembershipStatus: LegalMembershipStatus | null,
  userStatus: UserStatus,
): MembershipNoticeType {
  if (userStatus === "alumni") return "alumni";
  if (legalMembershipStatus === "application_pending")
    return "application_pending";
  if (legalMembershipStatus === "membership_reconfirmation_pending")
    return "membership_reconfirmation_pending";
  if (legalMembershipStatus === "manual_followup") return "manual_followup";

  if (legalMembershipStatus === "active") {
    if (membershipState.mandateCancelled) return "payment_cancelled";
    if (membershipState.payment === "not_started") return "payment_not_started";
  }

  return null;
}
