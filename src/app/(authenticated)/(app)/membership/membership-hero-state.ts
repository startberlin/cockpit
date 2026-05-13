import type { UserStatus } from "@/db/schema/auth";
import type { LegalMembershipStatus } from "@/db/schema/legal-membership";
import type { StructuredMembershipState } from "@/lib/membership-status";

export type MembershipHeroVariant =
  | "alumni"
  | "active_mandate_member"
  | "active_mandate_alumni"
  | "active_cancelled"
  | "active_no_payment"
  | "processing"
  | "manual_followup"
  | "application_pending"
  | "membership_reconfirmation_pending"
  | "cancelled"
  | "onboarding";

export function deriveMembershipHeroVariant(
  membershipState: Pick<
    StructuredMembershipState,
    "payment" | "mandateCancelled"
  >,
  legalMembershipStatus: LegalMembershipStatus | null,
  userStatus: UserStatus,
): MembershipHeroVariant {
  if (userStatus === "alumni") return "alumni";
  if (legalMembershipStatus === "processing") return "processing";
  if (legalMembershipStatus === "manual_followup") return "manual_followup";
  if (legalMembershipStatus === "application_pending")
    return "application_pending";
  if (legalMembershipStatus === "membership_reconfirmation_pending")
    return "membership_reconfirmation_pending";
  if (legalMembershipStatus === "cancelled") return "cancelled";

  if (legalMembershipStatus === "active") {
    if (membershipState.payment === "active") {
      return userStatus === "supporting_alumni"
        ? "active_mandate_alumni"
        : "active_mandate_member";
    }
    if (membershipState.mandateCancelled) return "active_cancelled";
    return "active_no_payment";
  }

  return "onboarding";
}
