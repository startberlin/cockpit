import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
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

const APPROVED_STATUSES: MembershipPaymentCycleStatus[] = [
  "pending",
  "submitted",
  "confirmed",
  "paid_out",
  "failed",
  "cancelled",
  "charged_back",
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
  extra?: Partial<
    Pick<MembershipPaymentCycle, "gocardlessPaymentId" | "declineReason">
  >,
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

const userPaymentColumns = {
  id: membershipPayments.id,
  userId: membershipPayments.userId,
  status: membershipPayments.status,
  activationDate: membershipPayments.activationDate,
  amount: membershipPayments.amount,
  gocardlessPaymentId: membershipPayments.gocardlessPaymentId,
  declineReason: membershipPayments.declineReason,
  createdAt: membershipPayments.createdAt,
  updatedAt: membershipPayments.updatedAt,
  userName: sql<string>`${user.firstName} || ' ' || ${user.lastName}`,
  userEmail: user.email,
  gocardlessMandateId: user.gocardlessMandateId,
  gocardlessCustomerId: user.gocardlessCustomerId,
} as const;

export interface MembershipPaymentCycleWithUser extends MembershipPaymentCycle {
  userName: string;
  userEmail: string;
  gocardlessMandateId: string | null;
  gocardlessCustomerId: string | null;
}

export async function getProposedPayments(): Promise<
  MembershipPaymentCycleWithUser[]
> {
  return db
    .select(userPaymentColumns)
    .from(membershipPayments)
    .innerJoin(user, eq(user.id, membershipPayments.userId))
    .where(eq(membershipPayments.status, "proposed"))
    .orderBy(membershipPayments.activationDate);
}

export async function getApprovedPaymentsPage(
  page: number,
  pageSize: number,
): Promise<{ rows: MembershipPaymentCycleWithUser[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select(userPaymentColumns)
      .from(membershipPayments)
      .innerJoin(user, eq(user.id, membershipPayments.userId))
      .where(inArray(membershipPayments.status, APPROVED_STATUSES))
      .orderBy(membershipPayments.activationDate)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ total: count() })
      .from(membershipPayments)
      .where(inArray(membershipPayments.status, APPROVED_STATUSES)),
  ]);

  return { rows, total };
}

export async function getDeclinedPaymentsPage(
  page: number,
  pageSize: number,
): Promise<{ rows: MembershipPaymentCycleWithUser[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select(userPaymentColumns)
      .from(membershipPayments)
      .innerJoin(user, eq(user.id, membershipPayments.userId))
      .where(eq(membershipPayments.status, "declined"))
      .orderBy(desc(membershipPayments.updatedAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ total: count() })
      .from(membershipPayments)
      .where(eq(membershipPayments.status, "declined")),
  ]);

  return { rows, total };
}

export interface PaymentStats {
  proposedCount: number;
  proposedAmount: number;
  inFlightCount: number;
  inFlightAmount: number;
  confirmedAmount: number;
  collectedAmount: number;
}

export async function getPaymentStats(): Promise<PaymentStats> {
  const oneYearAgo = new Date();
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
  const cutoff = oneYearAgo.toISOString().slice(0, 10);

  const rows = await db
    .select({
      status: membershipPayments.status,
      activationDate: membershipPayments.activationDate,
      amount: membershipPayments.amount,
    })
    .from(membershipPayments)
    .where(
      inArray(membershipPayments.status, [
        "proposed",
        "pending",
        "submitted",
        "confirmed",
        "paid_out",
      ]),
    );

  let proposedCount = 0;
  let proposedAmount = 0;
  let inFlightCount = 0;
  let inFlightAmount = 0;
  let confirmedAmount = 0;
  let collectedAmount = 0;

  for (const row of rows) {
    if (row.status === "proposed") {
      proposedCount++;
      proposedAmount += row.amount;
    } else if (row.status === "pending" || row.status === "submitted") {
      inFlightCount++;
      inFlightAmount += row.amount;
    } else if (row.status === "confirmed") {
      confirmedAmount += row.amount;
    } else if (row.status === "paid_out" && row.activationDate >= cutoff) {
      collectedAmount += row.amount;
    }
  }

  return {
    proposedCount,
    proposedAmount,
    inFlightCount,
    inFlightAmount,
    confirmedAmount,
    collectedAmount,
  };
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
