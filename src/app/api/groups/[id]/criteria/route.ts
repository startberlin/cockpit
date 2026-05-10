import { NextResponse } from "next/server";
import { canViewGroup, getGroupCriteria } from "@/db/groups";
import { getCurrentUser } from "@/db/user";

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

  if (!(await canViewGroup(id))) {
    return NextResponse.json(
      { error: "You are not authorized to view this group." },
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
