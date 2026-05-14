import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { User } from "@/db/schema/auth";

interface ContactDetailsCardProps {
  user: User;
}

function ContactField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground leading-none">
        {label}
      </span>
      <span className="text-sm font-medium">{value ?? "—"}</span>
    </div>
  );
}

export function ContactDetailsCard({ user }: ContactDetailsCardProps) {
  const addressLine = [
    user.street,
    [user.zip, user.city].filter(Boolean).join(" "),
    user.state,
    user.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col gap-6">
      <span className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Contact details</h2>
        <p className="text-sm text-muted-foreground">
          How START Berlin reaches you. Keep these up to date so we can contact
          you about your membership.
        </p>
      </span>
      <Card className="gap-0">
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ContactField label="Personal email" value={user.personalEmail} />
            <ContactField label="Phone" value={user.phone} />
            <ContactField label="START Berlin email" value={user.email} />
            <ContactField label="Address" value={addressLine || null} />
          </div>
          <div className="mt-6">
            <Button asChild variant="outline" size="sm">
              <Link href="/membership/settings">Edit details</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
