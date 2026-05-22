import { redirect } from "next/navigation";
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

  const [activeLegalMembership, pendingTransition] = await Promise.all([
    getActiveLegalMembership(user.id),
    getActiveMembershipTransitionRequest(user.id),
  ]);

  return (
    <MembershipPageContent
      user={user}
      activeLegalMembership={activeLegalMembership}
      pendingTransition={pendingTransition}
    />
  );
}
