"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { InfoIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { handleError } from "@/lib/utils";
import { submitAlumniAction } from "./submit-alumni-action";

const schema = z.object({
  personalEmail: z.email("Please enter a valid email address."),
  confirmedNoEvents: z.literal(true),
  confirmedAccountsClosed: z.literal(true),
});

type FormData = z.infer<typeof schema>;

interface StepAlumniFinalizeProps {
  currentPersonalEmail: string | null | undefined;
  companyEmail: string;
  isSupportingAlumni?: boolean;
}

export function StepAlumniFinalize({
  currentPersonalEmail,
  companyEmail,
  isSupportingAlumni,
}: StepAlumniFinalizeProps) {
  const router = useRouter();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      personalEmail: currentPersonalEmail ?? "",
      confirmedNoEvents: undefined,
      confirmedAccountsClosed: undefined,
    },
    mode: "onChange",
  });

  const { execute, isPending } = useAction(submitAlumniAction, {
    onSuccess: () => router.push("/membership"),
    onError: handleError,
  });

  return (
    <form
      className="flex flex-col gap-y-8"
      onSubmit={form.handleSubmit(({ personalEmail }) =>
        execute({ personalEmail }),
      )}
    >
      <FieldSet>
        <FieldGroup>
          <Controller
            name="personalEmail"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  Contact email address
                </FieldLabel>
                <FieldDescription className="text-sm text-muted-foreground -mt-2">
                  We'll send you a departure confirmation to this address.
                </FieldDescription>
                <Input
                  {...field}
                  id={field.name}
                  type="email"
                  placeholder="you@example.com"
                  aria-invalid={fieldState.invalid}
                  disabled={isPending}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldGroup>
          <Controller
            name="confirmedNoEvents"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field
                orientation="horizontal"
                className="items-start"
                data-invalid={fieldState.invalid}
              >
                <FieldLabel className="sr-only" htmlFor="confirmedNoEvents">
                  Please confirm that you understand
                </FieldLabel>
                <Checkbox
                  id="confirmedNoEvents"
                  checked={field.value === true}
                  onCheckedChange={(checked) =>
                    field.onChange(checked === true ? true : undefined)
                  }
                  disabled={isPending}
                />
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="confirmedNoEvents">
                    I understand that I will no longer be able to attend START
                    Berlin events, including startup visits, VC visits, and
                    community events.
                  </FieldLabel>
                </div>
              </Field>
            )}
          />
          <Controller
            name="confirmedAccountsClosed"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field
                orientation="horizontal"
                className="items-start"
                data-invalid={fieldState.invalid}
              >
                <Checkbox
                  id="confirmedAccountsClosed"
                  checked={field.value === true}
                  onCheckedChange={(checked) =>
                    field.onChange(checked === true ? true : undefined)
                  }
                  disabled={isPending}
                />
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="confirmedAccountsClosed">
                    I understand that my START Berlin Google account and email
                    address {companyEmail} will be permanently closed after my
                    departure request is processed.
                  </FieldLabel>
                </div>
              </Field>
            )}
          />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldGroup>
          <Field>
            <FieldLabel>
              {isSupportingAlumni ? "What happens next" : "Approval"}
            </FieldLabel>
            <div className="flex flex-col gap-3">
              {isSupportingAlumni ? (
                <p className="text-sm text-muted-foreground">
                  Your departure will be processed by the board. You'll receive
                  an email once it's confirmed.
                </p>
              ) : (
                <>
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
                    You'll receive an email notification as soon as your request
                    has been reviewed.
                  </p>
                </>
              )}
            </div>
          </Field>
        </FieldGroup>
      </FieldSet>

      <div className="flex gap-3">
        <Button type="button" variant="outline" asChild>
          <Link href="/membership/become-alumni/alumni-community">Back</Link>
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={!form.formState.isValid || isPending}
        >
          {isPending ? "Submitting…" : "Submit departure request"}
        </Button>
      </div>
    </form>
  );
}
