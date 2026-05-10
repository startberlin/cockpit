"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLinkIcon, InfoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import type { MembershipApplicationDeclarations } from "@/db/schema/membership-application";
import { FINANZORDNUNG_URL } from "@/lib/legal-documents/legal-document-paths";
import { handleError } from "@/lib/utils";
import { saveFeesDeclarationsAction } from "./step-fees-action";

const feesFormSchema = z.object({
  acceptsPrivacyNotice: z.literal(true),
  acknowledgesFee: z.literal(true),
});

type FeesFormData = z.infer<typeof feesFormSchema>;

interface StepFeesProps {
  legalMembershipId: string;
  declarations?: MembershipApplicationDeclarations | null;
}

export function StepFees({ legalMembershipId, declarations }: StepFeesProps) {
  const router = useRouter();

  const form = useForm<FeesFormData>({
    resolver: zodResolver(feesFormSchema),
    defaultValues: {
      acceptsPrivacyNotice: declarations?.acceptsPrivacyNotice ?? undefined,
      acknowledgesFee: declarations?.acknowledgesFee ?? undefined,
    },
    mode: "onChange",
  });

  const { execute, isPending } = useAction(saveFeesDeclarationsAction, {
    onSuccess: () => router.push("/membership/application/review"),
    onError: handleError,
  });

  const onSubmit = () => {
    execute({ legalMembershipId });
  };

  return (
    <form
      className="flex flex-col gap-y-6"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="flex flex-col gap-2">
        <iframe
          src={FINANZORDNUNG_URL}
          title="Finanzordnung (financial regulations) of START Berlin e.V."
          className="w-full h-96 rounded-md border"
        />
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Finanzordnung of START Berlin e.V.
          </span>
          <Button variant="ghost" size="sm" asChild>
            <a
              href={FINANZORDNUNG_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLinkIcon className="size-3.5" />
              Open in new tab
            </a>
          </Button>
        </div>
      </div>

      <Alert>
        <InfoIcon />
        <AlertTitle>No payment due now</AlertTitle>
        <AlertDescription>
          Accepting these regulations confirms you&apos;ve read and understood
          the fee structure. You&apos;ll set up your yearly membership payment
          as a separate step once your membership is confirmed — nothing is
          charged here.
        </AlertDescription>
      </Alert>

      <FieldSet>
        <FieldGroup>
          <Controller
            name="acceptsPrivacyNotice"
            control={form.control}
            render={({ field }) => (
              <Field orientation="horizontal">
                <Checkbox
                  id="acceptsPrivacyNotice"
                  checked={field.value === true}
                  onCheckedChange={(checked) =>
                    field.onChange(checked === true ? true : undefined)
                  }
                />
                <FieldLabel htmlFor="acceptsPrivacyNotice">
                  I have read and accept the privacy notice.
                </FieldLabel>
              </Field>
            )}
          />
          <Controller
            name="acknowledgesFee"
            control={form.control}
            render={({ field }) => (
              <Field orientation="horizontal">
                <Checkbox
                  id="acknowledgesFee"
                  checked={field.value === true}
                  onCheckedChange={(checked) =>
                    field.onChange(checked === true ? true : undefined)
                  }
                />
                <FieldLabel htmlFor="acknowledgesFee">
                  I acknowledge that, in accordance with §2 of the Financial
                  Regulations of START Berlin e.V., a membership fee of €20 per
                  semester applies. Upon joining, €40 are due for the first
                  year; subsequent annual payments of €40 are due every 12
                  months. I understand that the membership fee is non-refundable
                  if I leave the association early.
                </FieldLabel>
              </Field>
            )}
          />
        </FieldGroup>
      </FieldSet>

      <Button type="submit" disabled={!form.formState.isValid || isPending}>
        Next
      </Button>
    </form>
  );
}
