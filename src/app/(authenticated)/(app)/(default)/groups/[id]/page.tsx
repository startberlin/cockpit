import { notFound } from "next/navigation";
import * as React from "react";
import db from "@/db";
import { getGroupDetail } from "@/db/groups";
import {
  getMembersOfSystemGroup,
  getSystemGroupBySlug,
  isSystemGroupSlug,
} from "@/lib/groups/system-groups";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import GroupDetailClient from "./page-client";
import GroupDetailSkeleton from "./skeleton";

interface GroupPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: GroupPageProps) {
  const { id } = await params;
  const batches = await db.query.batch.findMany({ columns: { number: true } });

  if (isSystemGroupSlug(id, batches)) {
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

  const batches = await db.query.batch.findMany({ columns: { number: true } });

  if (isSystemGroupSlug(id, batches)) {
    const systemGroup = getSystemGroupBySlug(id);
    if (!systemGroup) notFound();

    const [users, positions] = await Promise.all([
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
