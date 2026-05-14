import { NextResponse } from "next/server";
import db from "@/db";
import { addGroupCriteria, addUsersMatchingCriteria } from "@/db/groups";
import { getCurrentUser } from "@/db/user";
import { addGroupCriteriaSchema } from "@/lib/groups/criteria";
import { can } from "@/lib/permissions/server";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!(await can("groups.manage_members"))) {
    return NextResponse.json(
      { error: "You are not authorized to manage group members." },
      { status: 403 },
    );
  }

  try {
    const parsed = addGroupCriteriaSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { criteria, addedUsersCount } = await db.transaction(async (tx) => {
      const criteria = await addGroupCriteria(
        {
          ...parsed.data,
          createdBy: currentUser.id,
        },
        tx,
      );

      const addedUsersCount = await addUsersMatchingCriteria(
        parsed.data.groupId,
        {
          department: parsed.data.department,
          status: parsed.data.status,
          batchNumber: parsed.data.batchNumber,
        },
      );

      return { criteria, addedUsersCount };
    });

    return NextResponse.json({
      criteria,
      addedUsersCount,
    });
  } catch (error) {
    console.error("Error adding group criteria:", error);
    return NextResponse.json(
      { error: "Failed to add group criteria" },
      { status: 500 },
    );
  }
}
