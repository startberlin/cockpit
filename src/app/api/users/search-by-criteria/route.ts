import { and, eq, inArray, or, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/db";
import {
  isGroupAuthorizationError,
  requireGroupMemberManagement,
} from "@/db/groups";
import { department, user, userStatus } from "@/db/schema/auth";
import { usersToGroups } from "@/db/schema/group";

const requestSchema = z.object({
  groupId: z.string(),
  criteria: z.object({
    departments: z.array(z.enum(department.enumValues)).optional(),
    statuses: z.array(z.enum(userStatus.enumValues)).optional(),
    batchNumbers: z.array(z.number()).optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    await requireGroupMemberManagement();

    const parsed = requestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { groupId, criteria } = parsed.data;
    const { departments, statuses, batchNumbers } = criteria;

    const conditions = [];

    if (departments?.length) {
      conditions.push(inArray(user.department, departments));
    }

    if (statuses?.length) {
      conditions.push(inArray(user.status, statuses));
    }

    if (batchNumbers?.length) {
      conditions.push(inArray(user.batchNumber, batchNumbers));
    }

    if (conditions.length === 0) {
      return NextResponse.json([]);
    }

    const usersNotInGroup = await db
      .select({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        department: user.department,
        status: user.status,
        batchNumber: user.batchNumber,
      })
      .from(user)
      .leftJoin(
        usersToGroups,
        and(
          eq(usersToGroups.userId, user.id),
          eq(usersToGroups.groupId, groupId),
        ),
      )
      .where(and(sql`${usersToGroups.userId} IS NULL`, or(...conditions)))
      .orderBy(user.firstName, user.lastName);

    return NextResponse.json(usersNotInGroup);
  } catch (error) {
    if (isGroupAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Error searching users by criteria:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
