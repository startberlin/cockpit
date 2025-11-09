import { redirect } from "next/navigation";
import { getCurrentUser } from "@/db/user";
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

  if (user.status === "onboarding") {
    return <MembershipOnboarding />;
  }

  return <p>Nothing to see here...</p>;
}
