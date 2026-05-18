import { NextResponse } from "next/server";
import { getGroupDetail } from "@/db/groups";
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

  if (!(await can("groups.view", { id }))) {
    return NextResponse.json(
      { error: "You are not authorized to view this group." },
      { status: 403 },
    );
  }

  try {
    const group = await getGroupDetail(id);

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error("Error fetching group details:", error);
    return NextResponse.json(
      { error: "Failed to fetch group details" },
      { status: 500 },
    );
  }
}
