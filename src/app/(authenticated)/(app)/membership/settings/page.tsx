import { redirect } from "next/navigation";
import { getCurrentUser } from "@/db/user";
import { createMetadata } from "@/lib/metadata";
import { SettingsForm } from "./settings-form";

export const metadata = createMetadata({
  title: "Membership Settings",
  description: "Edit your contact details.",
});

export default async function MembershipSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-semibold">Contact details</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update your personal contact information.
        </p>
      </div>
      <SettingsForm user={user} />
    </div>
  );
}
