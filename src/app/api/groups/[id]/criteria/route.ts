import { NextResponse } from "next/server";
import { getGroupCriteria } from "@/db/groups";
import { getCurrentUser } from "@/db/user";
import { can } from "@/lib/permissions/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!(await can("groups.manage_members"))) {
    return NextResponse.json(
      { error: "You are not authorized to manage this group." },
      { status: 403 },
    );
  }

  try {
    const criteria = await getGroupCriteria(id);
    return NextResponse.json({ criteria });
  } catch (error) {
    console.error("Error fetching group criteria:", error);
    return NextResponse.json(
      { error: "Failed to fetch group criteria" },
      { status: 500 },
    );
  }
}
