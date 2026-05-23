"use client";

import { CircleXIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { boardKickAction } from "@/app/(authenticated)/(app)/(default)/admin/people/[id]/board-kick-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";

interface RemovePageClientProps {
  userId: string;
  firstName: string;
  lastName: string;
  userEmail: string;
  backHref: string;
}

export function RemovePageClient({
  userId,
  firstName,
  lastName,
  userEmail,
  backHref,
}: RemovePageClientProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmedAccess, setConfirmedAccess] = useState(false);
  const [confirmedAccounts, setConfirmedAccounts] = useState(false);

  const { execute, isPending } = useAction(boardKickAction, {
    onSuccess: () => {
      toast.success(`${firstName} ${lastName} has been removed.`, {
        description: "Their account access has been revoked immediately.",
      });
      router.push("/admin/people");
    },
    onError: () => {
      toast.error(
        "Could not remove member. Please try again or contact operations@start-berlin.com.",
      );
    },
  });

  if (step === 1) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/25 bg-destructive/8 p-4 space-y-4">
          <p className="text-sm font-medium">What removing this member means</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CircleXIcon className="size-4 mt-0.5 shrink-0 text-destructive/60" />
              <span>
                {firstName} {lastName}&apos;s account access will be revoked
                immediately.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CircleXIcon className="size-4 mt-0.5 shrink-0 text-destructive/60" />
              <span>
                They will no longer be able to attend internal START Berlin
                events.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CircleXIcon className="size-4 mt-0.5 shrink-0 text-destructive/60" />
              <span>
                All START Berlin accounts will be permanently closed, including{" "}
                {userEmail}.
              </span>
            </li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href={backHref}>Cancel</Link>
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setStep(2)}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FieldSet>
        <FieldGroup>
          <Field orientation="horizontal" className="items-start">
            <Checkbox
              id="confirmedAccess"
              checked={confirmedAccess}
              onCheckedChange={(checked) =>
                setConfirmedAccess(checked === true)
              }
              disabled={isPending}
            />
            <FieldLabel htmlFor="confirmedAccess">
              I understand that {firstName} {lastName} will immediately lose
              access to all START Berlin systems and events.
            </FieldLabel>
          </Field>

          <Field orientation="horizontal" className="items-start">
            <Checkbox
              id="confirmedAccounts"
              checked={confirmedAccounts}
              onCheckedChange={(checked) =>
                setConfirmedAccounts(checked === true)
              }
              disabled={isPending}
            />
            <FieldLabel htmlFor="confirmedAccounts">
              I understand that all START Berlin accounts, including {userEmail}
              , will be permanently closed immediately after this is finalised.
            </FieldLabel>
          </Field>
        </FieldGroup>
      </FieldSet>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => setStep(1)}
        >
          Back
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={!confirmedAccess || !confirmedAccounts || isPending}
          onClick={() => execute({ targetUserId: userId })}
        >
          {isPending ? "Removing…" : "Remove member"}
        </Button>
      </div>
    </div>
  );
}
