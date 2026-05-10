import type { LegalMembershipState } from "@/db/schema/auth";

export interface LegalMemberSubject {
  legalMembershipState: LegalMembershipState;
}

/**
 * Legal privileges derive from legalMembershipState, never from user.status.
 * A member with legalMembershipState = "not_member" has no legal voting or
 * election eligibility regardless of their operational status.
 */
export function isLegalMember(subject: LegalMemberSubject): boolean {
  return subject.legalMembershipState === "active_member";
}

export function filterLegalMembers<T extends LegalMemberSubject>(
  subjects: T[],
): T[] {
  return subjects.filter(isLegalMember);
}
