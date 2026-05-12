import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ContactDetailsCardProps {
  email: string;
  personalEmail: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
}

function ContactField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

export function ContactDetailsCard({
  email,
  personalEmail,
  phone,
  street,
  city,
  state,
  zip,
  country,
}: ContactDetailsCardProps) {
  const addressLine = [
    street,
    [zip, city].filter(Boolean).join(" "),
    state,
    country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact details</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ContactField label="Workspace email" value={email} />
        <ContactField label="Personal email" value={personalEmail} />
        <ContactField label="Phone" value={phone} />
        <ContactField label="Address" value={addressLine || null} />
      </CardContent>
      <CardFooter>
        <Link
          href="/membership/settings"
          className="text-sm font-medium underline underline-offset-4"
        >
          Edit details
        </Link>
      </CardFooter>
    </Card>
  );
}
