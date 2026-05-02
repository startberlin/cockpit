import { notFound } from "next/navigation";
import { canViewGroup, getGroupDetailRaw } from "@/db/groups";
import { createMetadata } from "@/lib/metadata";
import GroupDetailClient from "./page-client";

interface GroupPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: GroupPageProps) {
  const { id } = await params;
  const mayViewGroup = await canViewGroup(id);

  if (!mayViewGroup) {
    return createMetadata({
      title: "Group",
      description: "View a START Berlin group.",
    });
  }

  const group = await getGroupDetailRaw(id);

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

export default async function GroupPage({ params }: GroupPageProps) {
  const { id } = await params;
  const mayViewGroup = await canViewGroup(id);

  if (!mayViewGroup) {
    notFound();
  }

  const group = await getGroupDetailRaw(id);

  if (!group) {
    notFound();
  }

  return <GroupDetailClient group={group} />;
}
