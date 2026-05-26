import { Check, CircleStar, CircleX } from "lucide-react";
import Link from "next/link";

const SUPPORTING_ALUMNI_BENEFITS = [
  "Receive invites to every START Berlin event, attend whenever you like",
  "No department work, no attendance obligations, no expectations",
  "Keep your Google account, email, and Slack access",
  "Join the START Berlin and START Network alumni community for life. You'll stay in the network even if you later end your membership",
  "Your membership stays unchanged at 40€ per year",
];

const ALUMNI_DOWNSIDES = [
  "Lose access to all internal START Berlin events like startup visits, VC visits, and community events",
  "Lose your Google account, email address, and Slack access",
  "Your START Berlin e.V. membership ends permanently",
];

export function StepChoose() {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/membership/become-alumni/supporting-alumni"
        className="text-left rounded-xl border-2 border-success/40 bg-success/5 p-5 flex flex-col gap-4 hover:border-success/60 hover:bg-success/8 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/50"
      >
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <CircleStar className="size-5 text-success shrink-0" />
            <span className="text-base font-semibold text-success">
              Stay at START Berlin
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Move to Supporting Alumni status. Stay connected with reduced
            obligations and keep your membership.
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {SUPPORTING_ALUMNI_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm">
              <Check className="size-4 mt-0.5 shrink-0 text-success/70" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <div className="inline-flex items-center rounded-md bg-success px-4 py-2 text-sm font-medium text-white">
            Become Supporting Alumni →
          </div>
        </div>
      </Link>

      <Link
        href="/membership/become-alumni/alumni-confirm"
        className="text-left rounded-xl border-2 border-border bg-background p-5 flex flex-col gap-4 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold">
            Cancel START Berlin e.V. membership
          </span>
          <p className="text-sm text-muted-foreground">
            End your membership, leave START Berlin and join the alumni network.
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {ALUMNI_DOWNSIDES.map((downside) => (
            <li key={downside} className="flex items-start gap-2 text-sm">
              <CircleX className="size-4 mt-0.5 shrink-0 text-destructive/60" />
              <span>{downside}</span>
            </li>
          ))}
        </ul>
      </Link>
    </div>
  );
}
