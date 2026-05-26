import { CircleXIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface StepAlumniConfirmProps {
  companyEmail: string;
  isSupportingAlumni?: boolean;
}

export function StepAlumniConfirm({
  companyEmail,
  isSupportingAlumni,
}: StepAlumniConfirmProps) {
  return (
    <div className="flex flex-col gap-y-8">
      <div className="rounded-lg border border-destructive/25 bg-destructive/8 p-4 flex flex-col gap-4">
        <p className="text-sm font-medium">
          What {isSupportingAlumni ? "this transition" : "cancellation"} means
        </p>
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CircleXIcon className="size-4 mt-0.5 shrink-0 text-destructive/60" />
            <span>
              {isSupportingAlumni
                ? "Your Supporting Alumni membership with START Berlin e.V. will end and you'll be listed as alumni."
                : "Your membership with START Berlin e.V. will end immediately upon processing."}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CircleXIcon className="size-4 mt-0.5 shrink-0 text-destructive/60" />
            <span>
              You will no longer be able to attend internal START Berlin events,
              including startup visits, VC visits, and community events.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CircleXIcon className="size-4 mt-0.5 shrink-0 text-destructive/60" />
            <span>
              All your START Berlin accounts will be permanently deleted,
              including your Google account and email address {companyEmail}.
            </span>
          </li>
        </ul>
      </div>

      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <TriangleAlertIcon className="size-4 shrink-0 text-destructive/60" />
        This action cannot be undone.
      </p>

      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <Link href="/membership/become-alumni">Back</Link>
        </Button>
        <Button asChild>
          <Link href="/membership/become-alumni/alumni-community">
            Continue
          </Link>
        </Button>
      </div>
    </div>
  );
}
