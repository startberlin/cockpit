import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
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

export async function getMemberSinceDate(userId: string): Promise<Date | null> {
  // Priority 1: explicit memberSinceDate set on the user (e.g. via import or admin)
  const userRow = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { memberSinceDate: true, batchNumber: true },
    with: { batch: { columns: { startDate: true } } },
  });

  if (!userRow) return null;

  if (userRow.memberSinceDate) {
    return new Date(`${userRow.memberSinceDate}T00:00:00`);
  }

  // Priority 2: batch start date (reflects when the cohort actually joined)
  if (userRow.batch) {
    return new Date(`${userRow.batch.startDate}T00:00:00`);
  }

  // Priority 3: activatedAt from a non-imported legal membership
  const membership = await db.query.legalMembership.findFirst({
    where: and(
      eq(legalMembership.userId, userId),
      isNotNull(legalMembership.activatedAt),
      isNull(legalMembership.importedPaidThroughAt),
    ),
    orderBy: asc(legalMembership.activatedAt),
    columns: { activatedAt: true },
  });

  return membership?.activatedAt ?? null;
}
