"use server";

import { getActiveLegalMembership } from "@/db/membership";
import type { LegalMembershipStatus } from "@/db/schema/legal-membership";
import { getCurrentUser } from "@/db/user";

export async function getLegalMembershipStatus(): Promise<LegalMembershipStatus | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const membership = await getActiveLegalMembership(user.id);
  return membership?.status ?? null;
}
