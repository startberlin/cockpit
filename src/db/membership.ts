import { eq } from "drizzle-orm";
import { nanoid } from "@/lib/id";
import db from ".";
import { user } from "./schema/auth";
import {
  type MembershipPaymentStatus,
  membershipPayment,
} from "./schema/membership";

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
