import { notFound } from "next/navigation";
import { getResolutionDetail } from "@/db/board-resolutions";
import { getCurrentUser } from "@/db/user";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import ResolutionVoteClient from "./resolution-vote-client";

export const metadata = createMetadata({
  title: "Board Resolution",
  description: "View and vote on a membership admission board resolution.",
});

export default async function VoteAdmissionPage({
  params,
}: {
  params: Promise<{ legalMembershipId: string }>;
}) {
  const { legalMembershipId } = await params;

  if (!(await can("membership.resolution.admission.view"))) {
    notFound();
  }

  const [currentUser, resolution] = await Promise.all([
    getCurrentUser(),
    getResolutionDetail(legalMembershipId),
  ]);

  if (!currentUser || !resolution) {
    notFound();
  }

  const isParticipant =
    currentUser.id !== resolution.subject.id &&
    resolution.participants.some((p) => p.userId === currentUser.id);

  return (
    <ResolutionVoteClient
      resolution={resolution}
      currentUserId={currentUser.id}
      isParticipant={isParticipant}
    />
  );
}
