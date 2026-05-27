import { notFound } from "next/navigation";
import * as React from "react";
import { BreadcrumbCrumb } from "@/components/breadcrumb-bridge";
import db from "@/db";
import { getGroupDetail, listAllUsersNotInGroup } from "@/db/groups";
import {
  getMembersOfSystemGroup,
  getSystemGroupBySlug,
  isSystemGroupSlug,
} from "@/lib/groups/system-groups";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import AdminGroupDetailClient from "./page-client";
import AdminGroupDetailSkeleton from "./skeleton";

function isSystemSlug(id: string) {
  return isSystemGroupSlug(id, []) || id.startsWith("batch-");
}

interface GroupPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; add?: string }>;
}

export async function generateMetadata({ params }: GroupPageProps) {
  const { id } = await params;

  if (isSystemSlug(id)) {
    const sg = getSystemGroupBySlug(id);
    return createMetadata({
      title: sg?.name ?? "Group",
      description: `Manage members of ${sg?.name ?? id}.`,
    });
  }

  const group = await getGroupDetail(id);
  if (!group) {
    return createMetadata({
      title: "Group Not Found",
      description: "The requested group does not exist.",
    });
  }

  return createMetadata({
    title: group.name,
    description: `Manage members of ${group.name}.`,
  });
}

export default async function AdminGroupPage({
  params,
  searchParams,
}: GroupPageProps) {
  const { id } = await params;
  const { page: pageParam, add } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  if (isSystemSlug(id)) {
    const systemGroup = getSystemGroupBySlug(id);
    if (!systemGroup) notFound();

    const [userRows, positions] = await Promise.all([
      db.query.user.findMany({
        columns: {
          id: true,
          status: true,
          department: true,
          batchNumber: true,
          email: true,
          firstName: true,
          lastName: true,
        },
        with: { accessGrants: { columns: { grant: true } } },
      }),
      db.query.userOrganizationPosition.findMany({
        columns: {
          userId: true,
          position: true,
          scope: true,
          department: true,
        },
      }),
    ]);

    const users = userRows.map((u) => ({
      id: u.id,
      status: u.status,
      department: u.department,
      batchNumber: u.batchNumber,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      grants: u.accessGrants.map((g) => g.grant),
    }));

    const members = getMembersOfSystemGroup(id, users, positions);

    return (
      <>
        <BreadcrumbCrumb
          crumbs={[
            { label: "Admin", href: "/admin" },
            { label: "All groups", href: "/admin/groups" },
            { label: systemGroup.name },
          ]}
        />
        <React.Suspense fallback={<AdminGroupDetailSkeleton />}>
          <AdminGroupDetailClient
            kind="system"
            slug={id}
            name={systemGroup.name}
            googleGroupEmail={systemGroup.googleGroupEmail}
            members={members}
          />
        </React.Suspense>
      </>
    );
  }

  const mayManageMembers = await can("group.members.manage", { id });
  const groupDetailPromise = getGroupDetail(id, page);
  const [group, availableUsers] = await Promise.all([
    groupDetailPromise,
    add !== undefined && mayManageMembers
      ? listAllUsersNotInGroup(id)
      : Promise.resolve(undefined),
  ]);
  if (!group) notFound();

  return (
    <>
      <BreadcrumbCrumb
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "All groups", href: "/admin/groups" },
          { label: group.name },
        ]}
      />
      <React.Suspense fallback={<AdminGroupDetailSkeleton />}>
        <AdminGroupDetailClient
          kind="manual"
          groupDetailPromise={groupDetailPromise}
          availableUsers={availableUsers ?? undefined}
        />
      </React.Suspense>
    </>
  );
}
