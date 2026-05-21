import { redirect } from "next/navigation";
import { getCurrentUser } from "@/db/user";
import { createMetadata } from "@/lib/metadata";
import { ToolsSection } from "../membership/tools-section";

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

  return (
    <ToolsSection
      title={
        user.status === "onboarding" ? "Get connected" : "My START Berlin tools"
      }
      description={
        user.status === "onboarding"
          ? "Join the START Berlin workspaces where members coordinate, share resources, and work on projects."
          : "Open the workspaces you use for communication, projects, and resources."
      }
      actionLabel={user.status === "onboarding" ? "Join" : "Open"}
    />
  );
}
