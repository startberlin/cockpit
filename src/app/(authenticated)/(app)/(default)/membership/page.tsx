import { redirect } from "next/navigation";
import { getCurrentUser } from "@/db/user";
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

  return <MembershipPageContent user={user} />;
}
