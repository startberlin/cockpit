import { NextResponse } from "next/server";
import { getAllGroupMembersForExport } from "@/db/groups";
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

  const canExport = await can("groups.export", { id });
  if (!canExport) {
    return NextResponse.json(
      { error: "You are not authorized to export this group." },
      { status: 403 },
    );
  }

  const members = await getAllGroupMembersForExport(id);

  const rows = [
    "name,email",
    ...members.map((m) => {
      const name = `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim();
      const email =
        m.eventEmailPreference === "personal_email" && m.personalEmail
          ? m.personalEmail
          : m.email;
      return `"${name}",${email}`;
    }),
  ];

  return new Response(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="group-members-luma.csv"`,
    },
  });
}
