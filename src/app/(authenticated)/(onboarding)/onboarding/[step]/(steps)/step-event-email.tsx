"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { AlertCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useWatch } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { User } from "@/db/schema/auth";
import { handleError } from "@/lib/utils";
import { saveEventEmailPreferenceAction } from "./step-event-email-action";

const schema = z
  .object({
    eventEmailPreference: z.enum(["personal_email", "start_email", "custom"], {
      message: "Please choose which email address to use for event invites.",
    }),
    eventInviteEmail: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.eventEmailPreference === "custom") {
      if (!z.email().safeParse(data.eventInviteEmail ?? "").success) {
        ctx.addIssue({
          code: "custom",
          message: "Please enter a valid email address.",
          path: ["eventInviteEmail"],
        });
      }
    }
  });

interface StepEventEmailProps {
  user: User;
}

export function StepEventEmail({ user }: StepEventEmailProps) {
  const router = useRouter();

  const { form, handleSubmitWithAction, action } = useHookFormAction(
    saveEventEmailPreferenceAction,
    zodResolver(schema),
    {
      actionProps: {
        onSuccess: () => router.push("/"),
        onError: handleError,
      },
      formProps: {
        defaultValues: {
          eventEmailPreference: user.eventEmailPreference ?? undefined,
          eventInviteEmail: user.eventInviteEmail ?? "",
        },
      },
    },
  );

  const watchedPreference = useWatch({
    control: form.control,
    name: "eventEmailPreference",
  });

  return (
    <form className="flex flex-col gap-y-8" onSubmit={handleSubmitWithAction}>
      <Controller
        name="eventEmailPreference"
        control={form.control}
        render={({ field }) => (
          <RadioGroup
            value={field.value ?? ""}
            onValueChange={field.onChange}
            disabled={action.isPending}
            className="gap-4"
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem
                value="start_email"
                id="pref-start"
                className="mt-0.5"
              />
              <Label
                htmlFor="pref-start"
                className="flex flex-col items-start gap-0.5 cursor-pointer"
              >
                <span className="font-medium">{user.email}</span>
                <span className="font-normal text-muted-foreground text-xs">
                  START Berlin email
                </span>
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <RadioGroupItem
                value="personal_email"
                id="pref-personal"
                className="mt-0.5"
              />
              <Label
                htmlFor="pref-personal"
                className="flex flex-col items-start gap-0.5 cursor-pointer"
              >
                <span className="font-medium">
                  {user.personalEmail || "No personal email on file"}
                </span>
                <span className="font-normal text-muted-foreground text-xs">
                  Personal email
                </span>
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <RadioGroupItem
                value="custom"
                id="pref-custom"
                className="-mt-0.5"
              />
              <div className="flex flex-col gap-2 flex-1">
                <Label
                  htmlFor="pref-custom"
                  className="flex flex-col items-start gap-0.5 cursor-pointer"
                >
                  <span className="font-medium">
                    Enter a custom email address
                  </span>
                </Label>
                <Controller
                  name="eventInviteEmail"
                  control={form.control}
                  render={({ field: emailField, fieldState }) => (
                    <div className="flex flex-col gap-1">
                      <Input
                        {...emailField}
                        type="email"
                        placeholder="you@example.com"
                        aria-invalid={fieldState.invalid}
                        onFocus={() => field.onChange("custom")}
                        disabled={action.isPending}
                      />
                      {fieldState.error && (
                        <p className="text-destructive text-xs">
                          {fieldState.error.message}
                        </p>
                      )}
                    </div>
                  )}
                />
              </div>
            </div>
          </RadioGroup>
        )}
      />
      {form.formState.errors.root && (
        <Alert className="text-destructive text-sm" variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>An error occurred</AlertTitle>
          <AlertDescription>
            <p>{form.formState.errors.root.message}</p>
          </AlertDescription>
        </Alert>
      )}
      <Button
        type="submit"
        disabled={!form.formState.isValid || action.isPending}
      >
        Next
      </Button>
    </form>
  );
}
