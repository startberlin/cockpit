"use client";

import { CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import type { User } from "@/db/schema/auth";
import type { MembershipApplication } from "@/db/schema/membership-application";
import { handleError } from "@/lib/utils";
import { submitApplicationAction } from "../submit-application-action";

function formatBirthDate(birthDate: string): string {
  const parts = birthDate.split("-");
  if (parts.length !== 3) return birthDate;
  const [year, month, day] = parts;
  return `${day}.${month}.${year}`;
}

const CONFIRMED_DECLARATIONS = [
  "I confirm that I am a natural person.",
  "I confirm that I have full legal capacity.",
  "I support the purpose of START Berlin e.V.",
  "I accept the bylaws (Satzung) of START Berlin e.V.",
  "I have read and accept the privacy notice.",
  "I acknowledge that, in accordance with §2 of the Financial Regulations of START Berlin e.V., a membership fee of €20 per semester applies. Upon joining, €40 are due for the first year; subsequent annual payments of €40 are due every 12 months. I understand that the membership fee is non-refundable if I leave the association early.",
];

interface StepReviewProps {
  user: Pick<User, "firstName" | "lastName">;
  legalMembershipId: string;
  draft: MembershipApplication;
  isReconfirmation?: boolean;
}

export function StepReview({
  user,
  legalMembershipId,
  draft,
  isReconfirmation = false,
}: StepReviewProps) {
  const router = useRouter();

  const { execute, isPending } = useAction(submitApplicationAction, {
    onSuccess: () => router.push("/membership"),
    onError: handleError,
  });

  return (
    <div className="flex flex-col gap-y-8">
      <FieldSet>
        <FieldLegend>Your Details</FieldLegend>
        <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm leading-relaxed space-y-1">
          <p>
            <span className="text-muted-foreground mr-2">Name</span>
            {user.firstName} {user.lastName}
          </p>
          {draft.birthDate && (
            <p>
              <span className="text-muted-foreground mr-2">Date of Birth</span>
              {formatBirthDate(draft.birthDate)}
            </p>
          )}
          {draft.personalEmail && (
            <p>
              <span className="text-muted-foreground mr-2">Email</span>
              {draft.personalEmail}
            </p>
          )}
          {draft.phone && (
            <p>
              <span className="text-muted-foreground mr-2">Phone</span>
              {draft.phone}
            </p>
          )}
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Your Address</FieldLegend>
        <FieldDescription className="text-xs -mt-2 mb-2">
          This address will be recorded on your membership application.
        </FieldDescription>
        <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm leading-relaxed">
          <p>{draft.street}</p>
          <p>
            {draft.zip} {draft.city}
          </p>
          {draft.state && <p>{draft.state}</p>}
          <p>{draft.country}</p>
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Confirmed Declarations</FieldLegend>
        <FieldDescription className="text-xs -mt-2 mb-3">
          You confirmed the following in the previous steps.
        </FieldDescription>
        <ul className="flex flex-col gap-2">
          {CONFIRMED_DECLARATIONS.map((declaration) => (
            <li key={declaration} className="flex items-start gap-2 text-sm">
              <CircleCheck className="size-4 mt-0.5 shrink-0 fill-success text-primary-foreground" />
              <span>{declaration}</span>
            </li>
          ))}
        </ul>
      </FieldSet>

      <Button
        onClick={() => execute({ legalMembershipId })}
        disabled={isPending}
      >
        {isPending
          ? "Submitting…"
          : isReconfirmation
            ? "Confirm membership"
            : "Submit Application"}
      </Button>
    </div>
  );
}
