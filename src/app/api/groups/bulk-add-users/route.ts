import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { addUsersToGroup } from "@/db/groups";
import { getCurrentUser } from "@/db/user";
import { can } from "@/lib/permissions/server";

const bulkAddUsersRequestSchema = z.object({
  groupId: z.string(),
  userIds: z.array(z.string()).min(1),
  role: z.enum(["admin", "member"]).default("member"),
});

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
    const parsed = bulkAddUsersRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid groupId, userIds, or role" },
        { status: 400 },
      );
    }

    const { groupId, userIds, role } = parsed.data;
    const added = await addUsersToGroup({ groupId, userIds, role });

    revalidatePath(`/groups/${groupId}`);

    return NextResponse.json({
      success: true,
      added,
    });
  } catch (error) {
    console.error("Error bulk adding users to group:", error);

    if (error instanceof Error && error.message.includes("unique")) {
      return NextResponse.json(
        { error: "One or more users are already in this group" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
