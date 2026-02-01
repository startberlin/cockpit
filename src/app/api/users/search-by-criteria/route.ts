import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import db from "@/db";
import { user } from "@/db/schema/auth";
import { usersToGroups } from "@/db/schema/group";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groupId, criteria } = body;

    if (!groupId || !criteria) {
      return NextResponse.json(
        { error: "Missing groupId or criteria" },
        { status: 400 }
      );
    }

    const { departments, roles, statuses, batchNumbers } = criteria;

    // Build the where conditions based on criteria
    const conditions = [];

    if (departments && departments.length > 0) {
      conditions.push(inArray(user.department, departments));
    }

    if (roles && roles.length > 0) {
      // roles is an array field, need to check if any role matches
      const roleConditions = roles.map(role => sql`${role} = ANY(${user.roles})`);
      conditions.push(or(...roleConditions));
    }

    if (statuses && statuses.length > 0) {
      conditions.push(inArray(user.status, statuses));
    }

    if (batchNumbers && batchNumbers.length > 0) {
      conditions.push(inArray(user.batchNumber, batchNumbers));
    }

    // If no criteria provided, return empty result
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
        and(eq(usersToGroups.userId, user.id), eq(usersToGroups.groupId, groupId))
      )
      .where(
        and(
          // User is not already in the group
          sql`${usersToGroups.userId} IS NULL`,
          // User matches the criteria (OR logic between different criteria types)
          or(...conditions)
        )
      )
      .orderBy(user.firstName, user.lastName);

    return NextResponse.json(usersNotInGroup);
  } catch (error) {
    console.error("Error searching users by criteria:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}