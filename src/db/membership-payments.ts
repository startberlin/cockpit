import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { newId } from "@/lib/id";
import db from ".";
import { user } from "./schema/auth";
import type {
  MembershipPaymentCycle,
  MembershipPaymentCycleStatus,
} from "./schema/membership-payments";
import { membershipPayments } from "./schema/membership-payments";

export type { MembershipPaymentCycle };

const IN_FLIGHT_STATUSES: MembershipPaymentCycleStatus[] = [
  "proposed",
  "pending",
  "submitted",
];

const COVERED_STATUSES: MembershipPaymentCycleStatus[] = [
  "confirmed",
  "paid_out",
];

export async function isMemberCovered(userId: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const row = await db.query.membershipPayments.findFirst({
    where: and(
      eq(membershipPayments.userId, userId),
      inArray(membershipPayments.status, COVERED_STATUSES),
      // activationDate + 1 year > today
      sql`${membershipPayments.activationDate}::date + interval '1 year' > ${today}::date`,
    ),
    columns: { id: true },
  });
  return row !== undefined;
}

export async function hasInFlightPayment(userId: string): Promise<boolean> {
  const row = await db.query.membershipPayments.findFirst({
    where: and(
      eq(membershipPayments.userId, userId),
      inArray(membershipPayments.status, IN_FLIGHT_STATUSES),
    ),
    columns: { id: true },
  });
  return row !== undefined;
}

export async function createProposedPayment(
  userId: string,
  activationDate: string,
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<MembershipPaymentCycle> {
  const ops = tx ?? db;
  const [created] = await ops
    .insert(membershipPayments)
    .values({
      id: newId("membershipPaymentCycle"),
      userId,
      activationDate,
      status: "proposed",
      amount: 4000,
    })
    .onConflictDoNothing()
    .returning();

  if (!created) {
    // Unique constraint on in-flight rows: a row already exists → find and return it
    const existing = await ops
      .select()
      .from(membershipPayments)
      .where(
        and(
          eq(membershipPayments.userId, userId),
          inArray(membershipPayments.status, IN_FLIGHT_STATUSES),
        ),
      )
      .limit(1);
    if (!existing[0]) {
      throw new Error(
        `createProposedPayment: conflict but no in-flight row found for user ${userId}`,
      );
    }
    return existing[0];
  }

  return created;
}

export async function getLastActivationDate(
  userId: string,
): Promise<string | null> {
  const row = await db.query.membershipPayments.findFirst({
    where: eq(membershipPayments.userId, userId),
    orderBy: (t, { desc }) => [desc(t.activationDate)],
    columns: { activationDate: true },
  });
  return row?.activationDate ?? null;
}

export async function getPaymentById(
  id: string,
): Promise<MembershipPaymentCycle | undefined> {
  return db.query.membershipPayments.findFirst({
    where: eq(membershipPayments.id, id),
  });
}

export async function advancePaymentStatus(
  id: string,
  from: MembershipPaymentCycleStatus | MembershipPaymentCycleStatus[],
  to: MembershipPaymentCycleStatus,
  extra?: Partial<Pick<MembershipPaymentCycle, "gocardlessPaymentId">>,
): Promise<boolean> {
  const fromArray = Array.isArray(from) ? from : [from];
  const [updated] = await db
    .update(membershipPayments)
    .set({ status: to, ...extra })
    .where(
      and(
        eq(membershipPayments.id, id),
        inArray(membershipPayments.status, fromArray),
      ),
    )
    .returning({ id: membershipPayments.id });
  return updated !== undefined;
}

export interface MembershipPaymentCycleWithUser extends MembershipPaymentCycle {
  userName: string;
  userEmail: string;
  gocardlessMandateId: string | null;
  gocardlessCustomerId: string | null;
}

export async function getAllPaymentsForPage(): Promise<
  MembershipPaymentCycleWithUser[]
> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      id: membershipPayments.id,
      userId: membershipPayments.userId,
      status: membershipPayments.status,
      activationDate: membershipPayments.activationDate,
      amount: membershipPayments.amount,
      gocardlessPaymentId: membershipPayments.gocardlessPaymentId,
      createdAt: membershipPayments.createdAt,
      updatedAt: membershipPayments.updatedAt,
      userName: sql<string>`${user.firstName} || ' ' || ${user.lastName}`,
      userEmail: user.email,
      gocardlessMandateId: user.gocardlessMandateId,
      gocardlessCustomerId: user.gocardlessCustomerId,
    })
    .from(membershipPayments)
    .innerJoin(user, eq(user.id, membershipPayments.userId))
    .where(lte(membershipPayments.activationDate, today))
    .orderBy(membershipPayments.activationDate);

  return rows;
}

export async function getMembersNeedingProposal(): Promise<
  Array<{
    id: string;
    gocardlessMandateId: string;
  }>
> {
  return db
    .select({
      id: user.id,
      gocardlessMandateId: user.gocardlessMandateId,
    })
    .from(user)
    .where(
      and(
        eq(user.status, "member"),
        sql`${user.gocardlessMandateId} IS NOT NULL`,
      ),
    ) as Promise<Array<{ id: string; gocardlessMandateId: string }>>;
}
