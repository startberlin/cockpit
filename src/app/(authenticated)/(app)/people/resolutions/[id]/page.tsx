import { notFound } from "next/navigation";
import { getResolutionDetail } from "@/db/board-resolutions";
import { getCurrentUser } from "@/db/user";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import ResolutionVoteClient from "./resolution-vote-client";

export const metadata = createMetadata({
  title: "Board Resolution",
  description: "Cast your vote on a membership admission board resolution.",
});

export default async function ResolutionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!(await can("membership.view_resolution"))) {
    notFound();
  }

  const [currentUser, resolution] = await Promise.all([
    getCurrentUser(),
    getResolutionDetail(id),
  ]);

  if (!currentUser) {
    notFound();
  }

  if (!resolution) {
    notFound();
  }

  // Auth gate: current user must be a participant of this resolution
  const isParticipant = resolution.participants.some(
    (p) => p.userId === currentUser.id,
  );

  if (!isParticipant) {
    notFound();
  }

  return (
    <ResolutionVoteClient
      resolution={resolution}
      currentUserId={currentUser.id}
    />
  );
}
