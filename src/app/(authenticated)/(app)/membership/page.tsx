import { redirect } from "next/navigation";
import { getMembershipPaymentByUserId } from "@/db/membership";
import { getCurrentUser } from "@/db/user";
import { getMembershipViewState } from "@/lib/membership-status";
import { createMetadata } from "@/lib/metadata";
import { MembershipPageContent } from "./onboarding";

export const metadata = createMetadata({
  title: "Cockpit",
  description: "Manage your membership, get access to software and more.",
});

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  const payment = await getMembershipPaymentByUserId(user.id);
  const membershipState = getMembershipViewState(user, payment);

  return (
    <MembershipPageContent
      membershipState={membershipState}
      userStatus={user.status}
      paidThroughAt={payment?.paidThroughAt}
    />
  );
}
