import { type NextRequest, NextResponse } from "next/server";
import { getGroupDetailRaw } from "@/db/groups";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const group = await getGroupDetailRaw(id);

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
