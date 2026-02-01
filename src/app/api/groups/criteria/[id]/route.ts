import { type NextRequest, NextResponse } from "next/server";
import { removeGroupCriteria } from "@/db/groups";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
