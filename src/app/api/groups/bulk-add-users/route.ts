import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import db from "@/db";
import { usersToGroups } from "@/db/schema/group";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groupId, userIds, role = "member" } = body;

    if (!groupId || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid groupId, userIds, or role" },
        { status: 400 }
      );
    }

    if (!["admin", "member"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'admin' or 'member'" },
        { status: 400 }
      );
    }

    // Prepare bulk insert data
    const insertData = userIds.map((userId: string) => ({
      userId,
      groupId,
      role,
    }));

    // Bulk insert all users to the group
    await db.insert(usersToGroups).values(insertData);

    // Revalidate the group page
    revalidatePath(`/groups/${groupId}`);

    return NextResponse.json({ 
      success: true, 
      added: userIds.length 
    });
  } catch (error) {
    console.error("Error bulk adding users to group:", error);
    
    // Check if it's a unique constraint violation (user already in group)
    if (error instanceof Error && error.message.includes("unique")) {
      return NextResponse.json(
        { error: "One or more users are already in this group" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}