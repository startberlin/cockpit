import { NextResponse } from "next/server";
import { removeGroupCriteria } from "@/db/groups";
import { getCurrentUser } from "@/db/user";
import { can } from "@/lib/permissions/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
    const { id } = await params;
    await removeGroupCriteria({ criteriaId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing group criteria:", error);
    return NextResponse.json(
      { error: "Failed to remove group criteria" },
      { status: 500 },
    );
  }
}
