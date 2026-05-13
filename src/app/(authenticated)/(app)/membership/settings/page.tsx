import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
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
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
          <Link href="/membership">
            <ArrowLeft />
            Back to membership
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Contact details
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Update your personal contact information.
          </p>
        </div>
      </div>
      <SettingsForm user={user} />
    </div>
  );
}
