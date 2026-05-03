import { type NextRequest, NextResponse } from "next/server";
import {
  isGroupAuthorizationError,
  removeGroupCriteria,
  requireGroupMemberManagement,
} from "@/db/groups";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireGroupMemberManagement();

    const { id } = await params;
    await removeGroupCriteria({ criteriaId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isGroupAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Error removing group criteria:", error);
    return NextResponse.json(
      { error: "Failed to remove group criteria" },
      { status: 500 },
    );
  }
}
