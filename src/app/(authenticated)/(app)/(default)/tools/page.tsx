import { redirect } from "next/navigation";
import { AppsGrid } from "@/components/apps/apps-grid";
import { getCurrentUser } from "@/db/user";
import { getVisibleAppSections } from "@/lib/apps/server";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Tools",
  description: "Access your START Berlin workspaces.",
});

export default async function ToolsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  if (user.status === "alumni" || user.status === "cancelled") {
    redirect("/membership");
  }

  const isOnboarding = user.status === "onboarding";
  const sections = await getVisibleAppSections();

  return (
    <AppsGrid
      title={isOnboarding ? "Get connected" : "My START Berlin tools"}
      description={
        isOnboarding
          ? "Join the START Berlin workspaces where members coordinate, share resources, and work on projects."
          : "Open the workspaces you use for communication, projects, and resources."
      }
      sections={sections}
      copyContext={{
        actionLabel: isOnboarding ? "Join" : "Open",
        status: user.status,
      }}
    />
  );
}
