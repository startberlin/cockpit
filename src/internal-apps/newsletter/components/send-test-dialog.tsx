"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormActionErrorMapper } from "@next-safe-action/adapter-react-hook-form/hooks";
import { TestTube } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendTestSchema } from "../actions/schemas";
import { sendTestAction } from "../actions/send";
import { parseError } from "../lib/error";

// Validate in the browser without transforming the field. The action performs
// the string-to-recipient-list transformation at the server boundary.
const formSchema = sendTestSchema.pick({ recipients: true });

export function SendTestDialog({
  issueId,
  defaultRecipient,
  beforeAction,
  getRevision,
}: {
  issueId: string;
  defaultRecipient: string;
  beforeAction: () => Promise<boolean>;
  getRevision: () => string;
}) {
  const [open, setOpen] = useState(false);
  const send = useAction(sendTestAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      setOpen(false);
      toast.success(
        data.mode === "sandbox"
          ? "Test recorded in sandbox. No email was sent."
          : `Test sent to ${data.recipients} recipient${data.recipients === 1 ? "" : "s"}.`,
      );
    },
    onError: ({ error }) => toast.error(parseError(error)),
  });
  const { hookFormValidationErrors } = useHookFormActionErrorMapper<
    typeof sendTestSchema
  >(send.result.validationErrors);
  const formErrors = useMemo(() => {
    if (!hookFormValidationErrors?.recipients) return undefined;
    // The server schema transforms this text field into an array. Collapse
    // array-item validation errors back onto the single recipient input.
    return {
      recipients: {
        type: "server",
        message: parseError({ validationErrors: send.result.validationErrors }),
      },
    };
  }, [hookFormValidationErrors, send.result.validationErrors]);
  const form = useForm<z.input<typeof formSchema>>({
    resolver: zodResolver(formSchema, undefined, { raw: true }),
    defaultValues: { recipients: defaultRecipient },
    errors: formErrors,
  });
  const busy = form.formState.isSubmitting || send.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) setOpen(value);
      }}
    >
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <TestTube />
        Send test
      </Button>
      <DialogContent className="grid-cols-1">
        <DialogHeader>
          <DialogTitle>Send a test</DialogTitle>
          <DialogDescription>
            Merge tags are replaced with sample values. Your latest edits are
            saved before the test is prepared.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(async (values) => {
            if (busy) return;
            if (!(await beforeAction())) return;
            await send.executeAsync({
              id: issueId,
              expectedUpdatedAt: getRevision(),
              recipients: values.recipients,
            });
          })}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="test-recipients">Recipients</Label>
            <Input
              id="test-recipients"
              {...form.register("recipients")}
              aria-invalid={!!form.formState.errors.recipients}
              aria-describedby={
                form.formState.errors.recipients
                  ? "test-recipient-help test-recipient-error"
                  : "test-recipient-help"
              }
              placeholder="you@start-berlin.com, colleague@start-berlin.com"
              disabled={busy}
            />
            <p
              id="test-recipient-help"
              className="text-xs text-muted-foreground"
            >
              Comma- or semicolon-separated, up to ten.
            </p>
            {form.formState.errors.recipients ? (
              <p
                id="test-recipient-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {form.formState.errors.recipients.message ??
                  parseError({
                    validationErrors: sendTestSchema
                      .safeParse({
                        id: issueId,
                        expectedUpdatedAt: getRevision(),
                        recipients: form.getValues("recipients"),
                      })
                      .error?.issues.map((issue) => issue.message),
                  })}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Preparing test" : "Send test"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
