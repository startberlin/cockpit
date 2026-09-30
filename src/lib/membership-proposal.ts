import type { LegalMembershipStatus } from "@/db/schema/legal-membership";

export function getMembershipProposalBlockReason(
  membership: {
    status: LegalMembershipStatus;
    inngestRunId: string | null;
  } | null,
): string | null {
  switch (membership?.status) {
    case "admission_pending":
      return membership.inngestRunId
        ? "A board admission vote is already in progress for this member."
        : null;
    case "application_pending":
      return "The board has already approved this member. They need to submit their membership application in My membership.";
    case "membership_reconfirmation_pending":
      return "This member already has a membership reconfirmation in progress.";
    case "processing":
      return "This member's membership application is already being processed.";
    case "active":
      return "This member already has an active legal membership.";
    default:
      return null;
  }
}
