import { and, desc, eq, inArray } from "drizzle-orm";
import type { UserStatus } from "@/db/schema/auth";
import {
  ACTIVE_TENURE_STATUSES,
  type LegalMembershipStatus,
  legalMembership,
} from "@/db/schema/legal-membership";
import { nanoid } from "@/lib/id";
import db from ".";
import { user } from "./schema/auth";

export async function getActiveLegalMembership(
  userId: string,
): Promise<{ id: string; status: LegalMembershipStatus } | null> {
  const row = await db.query.legalMembership.findFirst({
    where: and(
      eq(legalMembership.userId, userId),
      inArray(legalMembership.status, [...ACTIVE_TENURE_STATUSES]),
    ),
    orderBy: desc(legalMembership.startedAt),
    columns: { id: true, status: true },
  });

  return row ?? null;
}

export function newMembershipSessionId() {
  return `mps_${nanoid(16)}`;
}

export function requiresMembershipBilling(userStatus: UserStatus) {
  return userStatus === "member" || userStatus === "supporting_alumni";
}

export async function getUserByCustomerId(customerId: string) {
  return db.query.user.findFirst({
    where: eq(user.gocardlessCustomerId, customerId),
  });
}
