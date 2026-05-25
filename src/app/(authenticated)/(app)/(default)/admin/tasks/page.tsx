import { redirect } from "next/navigation";
import {
  type AdminTaskKind,
  getAdminTasksPage,
  getAllVisibleTaskMembers,
} from "@/db/admin-tasks";
import { getUserAuthority } from "@/db/authority";
import { getCurrentUser } from "@/db/user";
import { createMetadata } from "@/lib/metadata";
import {
  hasAdminGrant,
  hasPeopleAdminGrant,
  isLegalOfficer,
} from "@/lib/permissions";
import TasksPageClient from "./tasks-table-client";

export const metadata = createMetadata({
  title: "Tasks",
  description: "Open action items requiring your attention.",
});

const PAGE_SIZE = 20;
const VALID_KINDS = new Set<string>([
  "admission",
  "alumni_request",
  "supporting_alumni_request",
  "cancellation",
]);

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/membership");

  const authority = await getUserAuthority(currentUser.id);
  if (!authority) redirect("/membership");

  const headedDepts = authority.positions
    .filter(
      (p): p is Extract<typeof p, { scope: "department" }> =>
        p.scope === "department" && p.position === "department_head",
    )
    .map((p) => p.department);

  const canViewAdmission =
    hasAdminGrant(authority) ||
    isLegalOfficer(authority) ||
    headedDepts.length > 0;
  const canViewTransitions =
    hasPeopleAdminGrant(authority) ||
    isLegalOfficer(authority) ||
    headedDepts.length > 0;

  const viewableKinds: AdminTaskKind[] = [
    ...(canViewAdmission ? (["admission"] as const) : []),
    ...(canViewTransitions
      ? ([
          "alumni_request",
          "supporting_alumni_request",
          "cancellation",
        ] as const)
      : []),
  ];

  const params = await searchParams;
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const typesParam = Array.isArray(params.types)
    ? params.types[0]
    : params.types;
  const memberIdsParam = Array.isArray(params.memberIds)
    ? params.memberIds[0]
    : params.memberIds;

  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const requestedTypes = typesParam
    ? (typesParam
        .split(",")
        .filter((t) => VALID_KINDS.has(t)) as AdminTaskKind[])
    : [];
  const types = requestedTypes.filter((t) => viewableKinds.includes(t));

  const memberIds = memberIdsParam
    ? memberIdsParam.split(",").filter(Boolean)
    : [];

  const [{ rows, total, pageCount }, allMembers] = await Promise.all([
    getAdminTasksPage(
      authority,
      {
        types: types.length > 0 ? types : undefined,
        memberIds: memberIds.length > 0 ? memberIds : undefined,
      },
      { page, pageSize: PAGE_SIZE },
    ),
    getAllVisibleTaskMembers(authority),
  ]);

  return (
    <TasksPageClient
      rows={rows}
      total={total}
      pageCount={pageCount}
      allMembers={allMembers}
      viewableKinds={viewableKinds}
    />
  );
}
