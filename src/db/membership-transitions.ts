import { and, eq, inArray } from "drizzle-orm";
import db from "@/db";
import type { MembershipTransitionRequest } from "@/db/schema/membership-transition-request";
import { membershipTransitionRequest } from "@/db/schema/membership-transition-request";
import { newId } from "@/lib/id";

export type { MembershipTransitionRequest };

export async function getActiveMembershipTransitionRequest(
  userId: string,
): Promise<MembershipTransitionRequest | null> {
  const row = await db.query.membershipTransitionRequest.findFirst({
    where: (t, { eq: eqFn, and: andFn, inArray: inArrayFn }) =>
      andFn(
        eqFn(t.userId, userId),
        inArrayFn(t.status, ["pending", "acknowledged"]),
      ),
  });

  return row ?? null;
}

export async function createTransitionRequest(input: {
  userId: string;
  type: MembershipTransitionRequest["type"];
  reason?: MembershipTransitionRequest["reason"];
  keepPersonalEmail?: boolean;
  personalEmailForNotification?: string;
}): Promise<MembershipTransitionRequest> {
  const existing = await getActiveMembershipTransitionRequest(input.userId);
  if (existing) {
    throw new Error(
      "A pending transition request already exists for this user.",
    );
  }

  const [row] = await db
    .insert(membershipTransitionRequest)
    .values({
      id: newId("membershipTransitionRequest"),
      userId: input.userId,
      type: input.type,
      status: "pending",
      reason: input.reason ?? null,
      keepPersonalEmail: input.keepPersonalEmail ?? null,
      personalEmailForNotification: input.personalEmailForNotification ?? null,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create transition request.");
  }

  return row;
}

export async function updateTransitionRequestStatus(
  id: string,
  status: MembershipTransitionRequest["status"],
  decidedByUserId?: string,
): Promise<void> {
  await db
    .update(membershipTransitionRequest)
    .set({
      status,
      ...(decidedByUserId ? { decidedAt: new Date(), decidedByUserId } : {}),
    })
    .where(eq(membershipTransitionRequest.id, id));
}

export async function retractTransitionRequest(
  id: string,
  userId: string,
): Promise<void> {
  const row = await db.query.membershipTransitionRequest.findFirst({
    where: (t, { eq: eqFn }) => eqFn(t.id, id),
    columns: { userId: true, status: true },
  });

  if (!row) {
    throw new Error("Transition request not found.");
  }

  if (row.userId !== userId) {
    throw new Error("You are not authorized to retract this request.");
  }

  if (!["pending", "acknowledged"].includes(row.status)) {
    throw new Error("This request can no longer be retracted.");
  }

  await db
    .update(membershipTransitionRequest)
    .set({ status: "retracted" })
    .where(
      and(
        eq(membershipTransitionRequest.id, id),
        inArray(membershipTransitionRequest.status, [
          "pending",
          "acknowledged",
        ]),
      ),
    );
}
