import { redirect } from "next/navigation";
import { getMembershipPaymentByUserId } from "@/db/membership";
import { getCurrentUser } from "@/db/user";
import { getMembershipViewState } from "@/lib/membership-status";
import { createMetadata } from "@/lib/metadata";
import { MembershipOnboarding } from "./onboarding";

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

  if (membershipState === "profile_onboarding") {
    return <MembershipOnboarding />;
  }

  if (membershipState === "payment_pending") {
    return <MembershipOnboarding mode="payment_pending" />;
  }

  if (membershipState === "payment_processing") {
    return <MembershipOnboarding mode="payment_processing" />;
  }

  return <p>Nothing to see here...</p>;
}
