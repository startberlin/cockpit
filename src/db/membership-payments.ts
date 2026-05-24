import { and, count, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { newId } from "@/lib/id";
import { unaccentSearch } from "@/lib/search";
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
  "declined", // waived period — blocks re-proposal until the activation year expires
];

export const DEFAULT_HISTORY_STATUSES: MembershipPaymentCycleStatus[] = [
  "pending",
  "submitted",
  "confirmed",
  "paid_out",
  "failed",
  "cancelled",
  "charged_back",
];

export const ALL_HISTORY_STATUSES: MembershipPaymentCycleStatus[] = [
  ...DEFAULT_HISTORY_STATUSES,
  "declined",
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
  userEmail: string | null;
  gocardlessMandateId: string | null;
  gocardlessCustomerId: string | null;
}

export async function getProposedPayments(): Promise<
  MembershipPaymentCycleWithUser[]
> {
  const today = new Date().toISOString().slice(0, 10);
  return db
    .select(userPaymentColumns)
    .from(membershipPayments)
    .innerJoin(user, eq(user.id, membershipPayments.userId))
    .where(
      and(
        eq(membershipPayments.status, "proposed"),
        sql`${membershipPayments.activationDate}::date <= ${today}::date`,
      ),
    )
    .orderBy(membershipPayments.activationDate);
}

function sanitizeLikeTerm(value: string): string {
  // Strip ILIKE metacharacters — names and emails don't use % or _
  return value.trim().slice(0, 200).replace(/[%_]/g, "");
}

export async function getPaymentHistoryPage(
  page: number,
  pageSize: number,
  search?: string,
  statuses?: MembershipPaymentCycleStatus[],
): Promise<{ rows: MembershipPaymentCycleWithUser[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const term = search ? sanitizeLikeTerm(search) : null;
  const effectiveStatuses =
    statuses && statuses.length > 0 ? statuses : DEFAULT_HISTORY_STATUSES;

  const searchFilter = term
    ? unaccentSearch(
        term,
        user.firstName,
        user.lastName,
        user.email,
        sql`${user.firstName} || ' ' || ${user.lastName}`,
      )
    : null;

  const whereClause = searchFilter
    ? and(inArray(membershipPayments.status, effectiveStatuses), searchFilter)
    : inArray(membershipPayments.status, effectiveStatuses);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select(userPaymentColumns)
      .from(membershipPayments)
      .innerJoin(user, eq(user.id, membershipPayments.userId))
      .where(whereClause)
      .orderBy(membershipPayments.activationDate)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ total: count() })
      .from(membershipPayments)
      .innerJoin(user, eq(user.id, membershipPayments.userId))
      .where(whereClause),
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

  const today = new Date().toISOString().slice(0, 10);
  for (const row of rows) {
    if (row.status === "proposed" && row.activationDate <= today) {
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
    lastActivationDate: string | null;
  }>
> {
  const today = new Date().toISOString().slice(0, 10);
  return db
    .select({
      id: user.id,
      gocardlessMandateId: user.gocardlessMandateId,
      lastActivationDate: sql<string | null>`(
        SELECT mp.activation_date
        FROM membership_payments mp
        WHERE mp.user_id = ${user.id}
        AND mp.status IN ('confirmed', 'paid_out', 'declined')
        ORDER BY mp.activation_date DESC
        LIMIT 1
      )`,
    })
    .from(user)
    .where(
      and(
        inArray(user.status, ["member", "supporting_alumni"]),
        isNotNull(user.gocardlessMandateId),
        // Exclude members who are already covered for this cycle
        sql`NOT EXISTS (
          SELECT 1 FROM membership_payments mp
          WHERE mp.user_id = ${user.id}
          AND mp.status IN ('confirmed', 'paid_out', 'declined')
          AND mp.activation_date::date + interval '1 year' > ${today}::date
        )`,
        // Exclude members who already have an in-flight payment
        sql`NOT EXISTS (
          SELECT 1 FROM membership_payments mp
          WHERE mp.user_id = ${user.id}
          AND mp.status IN ('proposed', 'pending', 'submitted')
        )`,
      ),
    ) as Promise<
    Array<{
      id: string;
      gocardlessMandateId: string;
      lastActivationDate: string | null;
    }>
  >;
}

export async function getActivePaymentTerm(userId: string): Promise<{
  activationDate: string;
  status: MembershipPaymentCycleStatus;
} | null> {
  const today = new Date().toISOString().slice(0, 10);

  const covered = await db.query.membershipPayments.findFirst({
    where: and(
      eq(membershipPayments.userId, userId),
      inArray(membershipPayments.status, ["confirmed", "paid_out"]),
      sql`${membershipPayments.activationDate}::date + interval '1 year' > ${today}::date`,
    ),
    columns: { activationDate: true, status: true },
    orderBy: (t, { desc }) => [desc(t.activationDate)],
  });

  if (covered) return covered;

  const inFlight = await db.query.membershipPayments.findFirst({
    where: and(
      eq(membershipPayments.userId, userId),
      inArray(membershipPayments.status, ["pending", "submitted"]),
    ),
    columns: { activationDate: true, status: true },
    orderBy: (t, { desc }) => [desc(t.activationDate)],
  });

  return inFlight ?? null;
}

export async function batchCreateProposedPayments(
  members: Array<{ id: string; lastActivationDate: string | null }>,
): Promise<number> {
  if (members.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const rows = members.map((m) => {
    let activationDate: string;
    if (m.lastActivationDate) {
      const d = new Date(m.lastActivationDate);
      d.setFullYear(d.getFullYear() + 1);
      activationDate = d.toISOString().slice(0, 10);
    } else {
      activationDate = today;
    }
    return {
      id: newId("membershipPaymentCycle"),
      userId: m.id,
      activationDate,
      status: "proposed" as const,
      amount: 4000,
    };
  });

  await db.insert(membershipPayments).values(rows).onConflictDoNothing();
  return rows.length;
}
