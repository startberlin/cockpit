import { redirect } from "next/navigation";
import {
  type AdminTaskKind,
  getAdminTasksPage,
  getAllVisibleTaskMembers,
} from "@/db/admin-tasks";
import { getUserAuthority } from "@/db/authority";
import { getCurrentUser } from "@/db/user";
import { createMetadata } from "@/lib/metadata";
import { evaluateAuth, evaluateUnscopedViewDetails } from "@/lib/permissions";
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

  const canViewAdmission = evaluateAuth(
    authority,
    "membership.resolution.admission.view",
  );
  const canViewTransitions = evaluateAuth(
    authority,
    "membership.transition.view",
  );
  const canViewCancellations = evaluateAuth(
    authority,
    "membership.cancellation.view",
  );

  const viewableKinds: AdminTaskKind[] = [
    ...(canViewAdmission ? (["admission"] as const) : []),
    ...(canViewTransitions
      ? (["alumni_request", "supporting_alumni_request"] as const)
      : []),
    ...(canViewCancellations ? (["cancellation"] as const) : []),
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

  const enrichedRows = rows.map((row) => ({
    ...row,
    canAct:
      row.kind === "admission"
        ? evaluateAuth(authority, "membership.resolution.admission.vote")
        : row.kind === "alumni_request" ||
            row.kind === "supporting_alumni_request"
          ? evaluateAuth(authority, "membership.transition.decide", {
              targetDepartment: row.department,
            })
          : evaluateAuth(authority, "membership.cancellation.acknowledge", {
              targetDepartment: row.department,
            }),
  }));

  const canViewUserDetails = evaluateUnscopedViewDetails(authority);

  return (
    <TasksPageClient
      rows={enrichedRows}
      total={total}
      pageCount={pageCount}
      allMembers={allMembers}
      viewableKinds={viewableKinds}
      canViewUserDetails={canViewUserDetails}
    />
  );
}
