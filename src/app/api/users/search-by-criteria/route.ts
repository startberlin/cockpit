import { NextResponse } from "next/server";
import { findUsersNotInGroupByCriteria } from "@/db/groups";
import { getCurrentUser } from "@/db/user";
import { normalizedGroupCriteriaSchema } from "@/lib/groups/criteria";
import { can } from "@/lib/permissions/server";

const requestSchema = normalizedGroupCriteriaSchema
  .omit({ match: true })
  .extend({
    match: normalizedGroupCriteriaSchema.shape.match.optional(),
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
    const parsed = requestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const usersNotInGroup = await findUsersNotInGroupByCriteria({
      ...parsed.data,
      match: parsed.data.match ?? "any",
    });

    return NextResponse.json(usersNotInGroup);
  } catch (error) {
    console.error("Error searching users by criteria:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
