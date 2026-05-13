"use client";

import { AlertCircleIcon } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ImportGoogleWorkspaceUserData } from "./import-google-user-schema";

export interface MembershipStepProps {
  onComplete: () => void;
  onBack: () => void;
  isSubmitDisabled: boolean;
  isPending: boolean;
  rootError?: string;
}

export function MembershipStep({
  onComplete,
  onBack,
  isSubmitDisabled,
  isPending,
  rootError,
}: MembershipStepProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<ImportGoogleWorkspaceUserData>();

  return (
    <form
      className="flex flex-col gap-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onComplete();
      }}
    >
      <FieldSet>
        <FieldLegend>Membership payment</FieldLegend>
        <FieldDescription>
          Enter the member's last membership payment date. If they paid under
          one year ago, we will postpone the next payment. Leave blank if you
          don't know this.
        </FieldDescription>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="paidThroughDate">
              Date of last payment
            </FieldLabel>
            <Input
              id="paidThroughDate"
              type="date"
              aria-invalid={!!errors.paidThroughDate}
              {...register("paidThroughDate")}
            />
            <FieldError errors={[errors.paidThroughDate]} />
          </Field>
        </FieldGroup>
      </FieldSet>

      {rootError && (
        <Alert variant="destructive" className="text-sm">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Could not import member</AlertTitle>
          <AlertDescription>{rootError}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" disabled={isSubmitDisabled || isPending}>
          {isPending ? "Importing..." : "Import"}
        </Button>
      </div>
    </form>
  );
}
