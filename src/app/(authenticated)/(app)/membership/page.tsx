import { redirect } from "next/navigation";
import { getMembershipPaymentByUserId } from "@/db/membership";
import { getCurrentUser } from "@/db/user";
import { getStructuredMembershipState } from "@/lib/membership-status";
import { createMetadata } from "@/lib/metadata";
import { MembershipPageContent } from "./onboarding";

export const metadata = createMetadata({
  title: "Cockpit",
  description: "View your START Berlin membership status and tools.",
});

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  const payment = await getMembershipPaymentByUserId(user.id);
  const membershipState = getStructuredMembershipState(user, payment);

  return (
    <MembershipPageContent
      membershipState={membershipState}
      userStatus={user.status}
      paidThroughAt={payment?.paidThroughAt}
    />
  );
}
