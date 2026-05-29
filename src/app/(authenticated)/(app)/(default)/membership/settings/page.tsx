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

interface MembershipSettingsPageProps {
  searchParams: Promise<{ confirm?: string }>;
}

export default async function MembershipSettingsPage({
  searchParams,
}: MembershipSettingsPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  const { confirm } = await searchParams;
  const isConfirmMode = confirm === "1";

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div className="flex flex-col gap-4">
        {!isConfirmMode && (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="-ml-2 self-start"
          >
            <Link href="/membership">
              <ArrowLeft />
              Back to membership
            </Link>
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isConfirmMode ? "Confirm your member data" : "Contact details"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isConfirmMode
              ? "Please review your contact details and confirm they're still up to date."
              : "Update your personal contact information."}
          </p>
        </div>
      </div>
      <SettingsForm user={user} isConfirmMode={isConfirmMode} />
    </div>
  );
}
