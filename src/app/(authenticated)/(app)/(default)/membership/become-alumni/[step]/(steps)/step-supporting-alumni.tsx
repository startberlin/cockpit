"use client";

import { InfoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { handleError } from "@/lib/utils";
import { submitSupportingAlumniAction } from "./submit-supporting-alumni-action";

export function StepSupportingAlumni() {
  const router = useRouter();

  const { execute, isPending } = useAction(submitSupportingAlumniAction, {
    onSuccess: () => router.push("/membership"),
    onError: handleError,
  });

  return (
    <div className="flex flex-col gap-y-8">
      <FieldSet>
        <FieldLegend>Approval</FieldLegend>
        <div className="flex flex-col gap-3">
          <Alert>
            <InfoIcon />
            <AlertTitle>Your request will be reviewed</AlertTitle>
            <AlertDescription>
              The alumni status is granted after 1+ year(s) of active
              contributions to START Berlin and will be reviewed by your
              department head or the board.
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground">
            You'll receive an email notification as soon as your request has
            been reviewed.
          </p>
        </div>
      </FieldSet>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/membership/become-alumni")}
          disabled={isPending}
        >
          Back
        </Button>
        <Button onClick={() => execute()} disabled={isPending}>
          {isPending ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </div>
  );
}
