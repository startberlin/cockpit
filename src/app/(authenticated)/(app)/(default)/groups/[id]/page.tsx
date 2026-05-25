import { notFound } from "next/navigation";
import * as React from "react";
import db from "@/db";
import { getGroupDetail } from "@/db/groups";
import { getCurrentUser } from "@/db/user";
import {
  getMembersOfSystemGroup,
  getSystemGroupBySlug,
  getSystemGroupsForUser,
  isSystemGroupSlug,
} from "@/lib/groups/system-groups";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import GroupDetailClient from "./page-client";
import GroupDetailSkeleton from "./skeleton";

function isSystemSlug(id: string) {
  return isSystemGroupSlug(id, []) || id.startsWith("batch-");
}

interface GroupPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: GroupPageProps) {
  const { id } = await params;

  if (isSystemSlug(id)) {
    const sg = getSystemGroupBySlug(id);
    return createMetadata({
      title: sg?.name ?? "Group",
      description: `View members of ${sg?.name ?? id}.`,
    });
  }

  const mayViewGroup = await can("group.view", { id });
  if (!mayViewGroup) {
    return createMetadata({
      title: "Group",
      description: "View a START Berlin group.",
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
    description: `View and manage members of ${group.name}.`,
  });
}

export default async function GroupPage({
  params,
  searchParams,
}: GroupPageProps) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  if (isSystemSlug(id)) {
    const systemGroup = getSystemGroupBySlug(id);
    if (!systemGroup) notFound();

    const isAdmin = await can("users.import");
    if (!isAdmin) {
      const currentUser = await getCurrentUser();
      if (!currentUser) notFound();

      const [userRecord, userPositions, batches] = await Promise.all([
        db.query.user.findFirst({
          where: (u, { eq }) => eq(u.id, currentUser.id),
          columns: { status: true, department: true, batchNumber: true },
          with: { accessGrants: { columns: { grant: true } } },
        }),
        db.query.userOrganizationPosition.findMany({
          where: (p, { eq }) => eq(p.userId, currentUser.id),
          columns: { position: true, scope: true, department: true },
        }),
        db.query.batch.findMany({ columns: { number: true } }),
      ]);

      const memberOfGroup =
        userRecord &&
        getSystemGroupsForUser(
          {
            id: currentUser.id,
            status: userRecord.status,
            department: userRecord.department,
            batchNumber: userRecord.batchNumber,
            grants: userRecord.accessGrants.map((g) => g.grant),
          },
          userPositions,
          batches,
        ).some((g) => g.slug === id);

      if (!memberOfGroup) notFound();
    }

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
      <React.Suspense fallback={<GroupDetailSkeleton />}>
        <GroupDetailClient
          kind="system"
          name={systemGroup.name}
          googleGroupEmail={systemGroup.googleGroupEmail}
          members={members}
        />
      </React.Suspense>
    );
  }

  const mayViewGroup = await can("group.view", { id });
  if (!mayViewGroup) notFound();

  const groupDetailPromise = getGroupDetail(id, page);

  return (
    <React.Suspense fallback={<GroupDetailSkeleton />}>
      <GroupDetailClient
        kind="manual"
        groupDetailPromise={groupDetailPromise}
      />
    </React.Suspense>
  );
}
