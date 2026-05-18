import { notFound } from "next/navigation";
import * as React from "react";
import { getGroupDetail } from "@/db/groups";
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
  const mayViewGroup = await can("groups.view", { id });

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
    description: `View and manage members of ${group.name} group.`,
  });
}

export default async function GroupPage({
  params,
  searchParams,
}: GroupPageProps) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const mayViewGroup = await can("groups.view", { id });

  if (!mayViewGroup) {
    notFound();
  }

  const groupDetailPromise = getGroupDetail(id, page);

  return (
    <React.Suspense fallback={<GroupDetailSkeleton />}>
      <GroupDetailClient groupDetailPromise={groupDetailPromise} />
    </React.Suspense>
  );
}
