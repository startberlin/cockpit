import { redirect } from "next/navigation";
import db from "@/db";
import { getUserAuthority } from "@/db/authority";
import { getAllUsersForAdmin } from "@/db/people";
import {
  type Department,
  department as departmentEnum,
  type LegalMembershipState,
  legalMembershipState as legalMembershipStateEnum,
  type UserStatus,
  userStatus,
} from "@/db/schema/auth";
import { batch } from "@/db/schema/batch";
import { getCurrentUser } from "@/db/user";
import { createMetadata } from "@/lib/metadata";
import { evaluateAuth, evaluateUnscopedViewDetails } from "@/lib/permissions";
import { can } from "@/lib/permissions/server";
import AdminDirectoryPageClient from "./page-client";

export const metadata = createMetadata({
  title: "People",
  description: "Manage START Berlin members.",
});

const ACTIVE_STATUSES: UserStatus[] = [
  "onboarding",
  "member",
  "supporting_alumni",
];
const INACTIVE_STATUSES: UserStatus[] = ["alumni", "cancelled"];

interface PageProps {
  searchParams: Promise<{
    page?: string;
    q?: string;
    department?: string;
    batchNumber?: string;
    status?: string;
    legalMembership?: string;
  }>;
}

export default async function AdminDirectoryPage({ searchParams }: PageProps) {
  if (!(await can("user.view_details"))) {
    redirect("/membership");
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/membership");
  }

  const authority = await getUserAuthority(currentUser.id);
  if (!authority) {
    redirect("/membership");
  }

  const canViewInactive = evaluateAuth(authority, "users.view_inactive");
  const isUnrestrictedViewer =
    evaluateUnscopedViewDetails(authority) &&
    !authority.positions.some(
      (p) => p.scope === "department" && p.position === "department_head",
    );

  const forcedDeptHead = !isUnrestrictedViewer
    ? (authority.positions.find(
        (p) => p.scope === "department" && p.position === "department_head",
      )?.department ?? null)
    : null;

  const {
    page: pageParam,
    q: search = "",
    department,
    batchNumber,
    status,
    legalMembership: legalMembershipParam,
  } = await searchParams;

  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const validStatuses = new Set<string>(userStatus.enumValues);
  const requestedStatuses = status
    ? status.split(",").filter((s): s is UserStatus => validStatuses.has(s))
    : undefined;

  const statusFilter = (() => {
    if (!requestedStatuses) return ACTIVE_STATUSES;
    if (!canViewInactive) {
      const filtered = requestedStatuses.filter(
        (s) => !INACTIVE_STATUSES.includes(s),
      );
      return filtered.length > 0 ? filtered : ACTIVE_STATUSES;
    }
    return requestedStatuses;
  })();

  const validDepartments = new Set<string>(departmentEnum.enumValues);

  const deptFilter: Department[] | undefined = forcedDeptHead
    ? [forcedDeptHead]
    : department
      ? (department
          .split(",")
          .filter((d) => validDepartments.has(d)) as Department[])
      : undefined;

  const validBatches = batchNumber
    ? batchNumber
        .split(",")
        .map((n) => parseInt(n, 10))
        .filter((n) => !Number.isNaN(n))
    : undefined;

  const validLegalStates = new Set<string>(legalMembershipStateEnum.enumValues);
  const legalMembershipFilter =
    legalMembershipParam && validLegalStates.has(legalMembershipParam)
      ? (legalMembershipParam as LegalMembershipState)
      : undefined;

  const [usersPromise, batches] = [
    getAllUsersForAdmin({
      page,
      search,
      department: deptFilter?.length ? deptFilter : undefined,
      batchNumber: validBatches?.length ? validBatches : undefined,
      status: statusFilter,
      legalMembershipState: legalMembershipFilter,
    }),
    db.select({ number: batch.number }).from(batch).orderBy(batch.number),
  ];

  const [canCreate, canImport] = await Promise.all([
    can("users.create"),
    can("users.import"),
  ]);

  return (
    <AdminDirectoryPageClient
      usersPromise={usersPromise}
      batches={await batches}
      initialSearch={search}
      canViewInactive={canViewInactive}
      isDeptHeadScoped={forcedDeptHead !== null}
      canCreate={canCreate}
      canImport={canImport}
    />
  );
}
