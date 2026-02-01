import { type NextRequest, NextResponse } from "next/server";
import { getGroupCriteria } from "@/db/groups";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await getGroupCriteria({ groupId: id });
    return NextResponse.json({ criteria: result.data });
  } catch (error) {
    console.error("Error fetching group criteria:", error);
    return NextResponse.json(
      { error: "Failed to fetch group criteria" },
      { status: 500 },
    );
  }
}
