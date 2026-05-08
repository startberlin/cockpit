import { and, eq, inArray } from "drizzle-orm";
import type { UserStatus } from "@/db/schema/auth";
import {
  type LegalMembershipStatus,
  legalMembership,
} from "@/db/schema/legal-membership";
import { nanoid } from "@/lib/id";
import db from ".";
import { user } from "./schema/auth";
import {
  type MembershipPaymentStatus,
  membershipPayment,
} from "./schema/membership";

const ACTIVE_LEGAL_MEMBERSHIP_STATUSES: LegalMembershipStatus[] = [
  "admission_pending",
  "application_pending",
  "processing",
  "active",
  "manual_followup",
];

export async function getActiveLegalMembership(
  userId: string,
): Promise<{ id: string; status: LegalMembershipStatus } | null> {
  const row = await db.query.legalMembership.findFirst({
    where: and(
      eq(legalMembership.userId, userId),
      inArray(legalMembership.status, ACTIVE_LEGAL_MEMBERSHIP_STATUSES),
    ),
    columns: { id: true, status: true },
  });

  return row ?? null;
}

export function newMembershipPaymentId() {
  return `mmp_${nanoid(16)}`;
}

export function newMembershipSessionId() {
  return `mps_${nanoid(16)}`;
}

export async function getMembershipPaymentByUserId(userId: string) {
  return db.query.membershipPayment.findFirst({
    where: eq(membershipPayment.userId, userId),
  });
}

export async function getMembershipPaymentByBillingRequestFlowId(
  billingRequestFlowId: string,
) {
  return db.query.membershipPayment.findFirst({
    where: eq(
      membershipPayment.gocardlessBillingRequestFlowId,
      billingRequestFlowId,
    ),
  });
}

export async function getMembershipPaymentByBillingRequestId(
  billingRequestId: string,
) {
  return db.query.membershipPayment.findFirst({
    where: eq(membershipPayment.gocardlessBillingRequestId, billingRequestId),
  });
}

export async function createOrReuseMembershipPayment(userId: string) {
  const existing = await getMembershipPaymentByUserId(userId);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(membershipPayment)
    .values({
      id: newMembershipPaymentId(),
      userId,
      status: "pending",
    })
    .returning();

  return created;
}

export function importedMembershipPaymentValues({
  userId,
  paidThroughAt,
}: {
  userId: string;
  paidThroughAt?: Date | null;
}) {
  return {
    id: newMembershipPaymentId(),
    userId,
    ...importedMembershipPaymentCoverage(paidThroughAt),
  };
}

function importedMembershipPaymentCoverage(paidThroughAt?: Date | null) {
  return {
    status: "pending" as const,
    provider: "gocardless",
    paidThroughAt: paidThroughAt ?? null,
    activatedAt: null,
  };
}

export function requiresMembershipBilling(userStatus: UserStatus) {
  return userStatus === "member" || userStatus === "supporting_alumni";
}

export async function markMembershipCheckoutStarted({
  userId,
  gocardlessCustomerId,
  gocardlessBillingRequestId,
  gocardlessBillingRequestFlowId,
}: {
  userId: string;
  gocardlessCustomerId?: string | null;
  gocardlessBillingRequestId: string;
  gocardlessBillingRequestFlowId: string;
}) {
  const payment = await createOrReuseMembershipPayment(userId);

  const [updated] = await db
    .update(membershipPayment)
    .set({
      status: "checkout_started",
      gocardlessCustomerId:
        gocardlessCustomerId ?? payment.gocardlessCustomerId ?? null,
      gocardlessBillingRequestId,
      gocardlessBillingRequestFlowId,
    })
    .where(eq(membershipPayment.id, payment.id))
    .returning();

  return updated;
}

export async function activateMembershipPayment({
  membershipPaymentId,
  gocardlessCustomerId,
  gocardlessMandateId,
  gocardlessSubscriptionId,
}: {
  membershipPaymentId: string;
  gocardlessCustomerId?: string | null;
  gocardlessMandateId: string;
  gocardlessSubscriptionId: string;
}) {
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .update(membershipPayment)
      .set({
        status: "active",
        gocardlessCustomerId,
        gocardlessMandateId,
        gocardlessSubscriptionId,
        activatedAt: new Date(),
      })
      .where(eq(membershipPayment.id, membershipPaymentId))
      .returning();

    await tx
      .update(user)
      .set({ status: "member" })
      .where(eq(user.id, payment.userId));

    return payment;
  });
}

export async function recordMembershipProviderState({
  membershipPaymentId,
  status,
  gocardlessCustomerId,
  gocardlessBillingRequestId,
  gocardlessBillingRequestFlowId,
  gocardlessMandateId,
  gocardlessSubscriptionId,
}: {
  membershipPaymentId: string;
  status?: MembershipPaymentStatus;
  gocardlessCustomerId?: string | null;
  gocardlessBillingRequestId?: string | null;
  gocardlessBillingRequestFlowId?: string | null;
  gocardlessMandateId?: string | null;
  gocardlessSubscriptionId?: string | null;
}) {
  const [updated] = await db
    .update(membershipPayment)
    .set({
      ...(status ? { status } : {}),
      ...(gocardlessCustomerId !== undefined ? { gocardlessCustomerId } : {}),
      ...(gocardlessBillingRequestId !== undefined
        ? { gocardlessBillingRequestId }
        : {}),
      ...(gocardlessBillingRequestFlowId !== undefined
        ? { gocardlessBillingRequestFlowId }
        : {}),
      ...(gocardlessMandateId !== undefined ? { gocardlessMandateId } : {}),
      ...(gocardlessSubscriptionId !== undefined
        ? { gocardlessSubscriptionId }
        : {}),
      activatedAt: status === "active" ? new Date() : undefined,
    })
    .where(eq(membershipPayment.id, membershipPaymentId))
    .returning();

  return updated;
}
