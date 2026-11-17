import { redirect } from "next/navigation";
import db from "@/db";
import { getActiveLegalMembership } from "@/db/membership";
import { getActiveMembershipTransitionRequest } from "@/db/membership-transitions";
import { getCurrentUser } from "@/db/user";
import { createMetadata } from "@/lib/metadata";
import { MembershipPageContent } from "./membership-page-content";

export const metadata = createMetadata({
  title: "Cockpit",
  description: "View your START Berlin membership status and tools.",
});

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  const [activeLegalMembership, pendingTransition, participation] =
    await Promise.all([
      getActiveLegalMembership(user.id),
      getActiveMembershipTransitionRequest(user.id),
      user.status === "member"
        ? db.query.user.findFirst({
            where: (u, { eq }) => eq(u.id, user.id),
            columns: { participationPausedAt: true },
          })
        : null,
    ]);

  return (
    <MembershipPageContent
      user={user}
      activeLegalMembership={activeLegalMembership}
      pendingTransition={pendingTransition}
      participationPausedAt={participation?.participationPausedAt ?? null}
    />
  );
}
