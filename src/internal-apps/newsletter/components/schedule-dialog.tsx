"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormActionErrorMapper } from "@next-safe-action/adapter-react-hook-form/hooks";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Loader2,
  Send,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { scheduleIssueSchema } from "../actions/schemas";
import { preflightAction, scheduleIssueAction } from "../actions/send";
import { parseError } from "../lib/error";
import type { IssueSendingSettings, SendingOption } from "./issue-actions";

const NO_OVERRIDE = "__default__";
const formSchema = scheduleIssueSchema
  .omit({ scheduledAt: true, expectedUpdatedAt: true })
  .extend({
    when: z
      .string()
      .refine(
        (value) => !value || Date.parse(value) > Date.now(),
        "Choose a valid send time in the future.",
      ),
  });
type FormValues = z.input<typeof formSchema>;
type PreflightData = NonNullable<
  Awaited<ReturnType<typeof preflightAction>>
>["data"];
type Problem = { code: string; message: string };

/** datetime-local must display local time; only the final payload uses UTC. */
function localDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function presets() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const monday = new Date(now);
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));
  monday.setHours(9, 0, 0, 0);
  return [
    { label: "In an hour", value: new Date(now.getTime() + 3600000) },
    { label: "Tomorrow, 09:00", value: tomorrow },
    { label: "Next Monday, 09:00", value: monday },
  ];
}

export function ScheduleDialog({
  issueId,
  mode,
  subject,
  previewText,
  settings,
  segments,
  topics,
  defaultFrom,
  beforeAction,
  getRevision,
}: {
  issueId: string;
  mode: "sandbox" | "live";
  subject: string;
  previewText: string;
  settings: IssueSendingSettings;
  segments: SendingOption[];
  topics: SendingOption[];
  defaultFrom: string;
  beforeAction: () => Promise<boolean>;
  getRevision: () => string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [preflightAttempt, setPreflightAttempt] = useState(0);
  const [check, setCheck] = useState<{
    segmentId: string;
    attempt: number;
    data?: PreflightData;
    error?: string;
  } | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const callbacks = useRef({ beforeAction, getRevision });
  useEffect(() => {
    callbacks.current = { beforeAction, getRevision };
  }, [beforeAction, getRevision]);
  const schedule = useAction(scheduleIssueAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      if (!data.ok) {
        const timeProblem = data.problems.find(
          (problem) => problem.code === "past-time",
        );
        if (timeProblem)
          form.setError(
            "when",
            { message: timeProblem.message },
            { shouldFocus: true },
          );
        setProblems(
          data.problems.filter((problem) => problem.code !== "past-time"),
        );
        return;
      }
      setOpen(false);
      toast.success(
        data.mode === "sandbox"
          ? "Sandbox run recorded. No email will be delivered."
          : data.scheduled
            ? "Issue scheduled."
            : "Issue is sending.",
      );
      router.refresh();
    },
    onError: ({ error }) => toast.error(parseError(error)),
  });
  const { hookFormValidationErrors } = useHookFormActionErrorMapper<
    typeof scheduleIssueSchema
  >(schedule.result.validationErrors);
  const formErrors = useMemo(
    () => ({
      ...hookFormValidationErrors,
      when: hookFormValidationErrors?.scheduledAt,
    }),
    [hookFormValidationErrors],
  );
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: issueId,
      when: "",
      fromAddress: settings.fromAddress ?? "",
      replyTo: settings.replyTo ?? "",
      segmentId: settings.segmentId ?? "",
      topicId: settings.topicId ?? "",
    },
    errors: formErrors,
  });
  const segmentId = form.watch("segmentId") ?? "";
  const topicId = form.watch("topicId") ?? "";
  const fromAddress = form.watch("fromAddress") || defaultFrom;
  const when = form.watch("when");

  useEffect(() => {
    if (!open) return;
    let current = true;
    setCheck(null);
    setProblems([]);
    // Each segment choice owns its result. A slow response for an earlier
    // choice must never enable a send or replace the current recipient count.
    void (async () => {
      if (!(await callbacks.current.beforeAction())) {
        throw new Error(
          "Save the latest draft before checking delivery. Reload the issue if another editor has changed it.",
        );
      }
      if (!current) return;
      return preflightAction({
        id: issueId,
        segmentId,
        expectedUpdatedAt: callbacks.current.getRevision(),
      });
    })()
      .then((result) => {
        if (!current) return;
        if (result?.data)
          setCheck({ segmentId, attempt: preflightAttempt, data: result.data });
        else
          setCheck({
            segmentId,
            attempt: preflightAttempt,
            error: parseError(result),
          });
      })
      .catch((error) => {
        if (current)
          setCheck({
            segmentId,
            attempt: preflightAttempt,
            error: parseError(error),
          });
      });
    return () => {
      current = false;
    };
  }, [open, issueId, segmentId, preflightAttempt]);

  const currentCheck =
    check?.segmentId === segmentId && check.attempt === preflightAttempt
      ? check
      : null;
  const info = currentCheck?.data;
  const checkError = currentCheck?.error;
  const checking = !info && !checkError;
  const allProblems = Array.from(
    new Map(
      [...problems, ...(info?.problems ?? [])].map((problem) => [
        problem.code,
        problem,
      ]),
    ).values(),
  );
  const blocked = checking || !!checkError || allProblems.length > 0;
  const busy = schedule.isPending || form.formState.isSubmitting;

  async function submit(values: FormValues, immediate = false) {
    if (blocked || schedule.isPending || !(await beforeAction())) return;
    if (!immediate && !values.when) {
      form.setError(
        "when",
        { message: "Choose a send time." },
        { shouldFocus: true },
      );
      return;
    }
    const { when: localTime, ...payload } = values;
    await schedule.executeAsync({
      ...payload,
      expectedUpdatedAt: getRevision(),
      scheduledAt: immediate ? "" : new Date(localTime).toISOString(),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) setOpen(value);
      }}
    >
      <Button
        size="sm"
        disabled={opening}
        onClick={async () => {
          setOpening(true);
          try {
            if (await beforeAction()) {
              setCheck(null);
              setOpen(true);
            }
          } finally {
            setOpening(false);
          }
        }}
      >
        <CalendarClock />
        {opening ? "Saving" : "Schedule"}
      </Button>
      <DialogContent className="max-h-[88vh] grid-cols-1 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule this issue</DialogTitle>
          <DialogDescription>
            Confirm the audience and delivery settings. Times are in{" "}
            {Intl.DateTimeFormat().resolvedOptions().timeZone}.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-w-0 flex-col gap-4"
          onSubmit={form.handleSubmit((values) => submit(values))}
        >
          <div className="border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              {(
                fromAddress.match(/^\s*"?([^"<]+?)"?\s*</)?.[1] ?? fromAddress
              ).trim()}
            </p>
            <p className="truncate font-medium">
              {subject || "No subject line yet"}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {previewText || "No preview text"}
            </p>
          </div>
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-3 border p-3 text-sm"
          >
            {checking ? (
              <>
                <Loader2 className="size-4 shrink-0 animate-spin" />
                <span>Checking recipients</span>
              </>
            ) : checkError || allProblems.length ? (
              <>
                <AlertTriangle className="size-4 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium">Not ready to send</p>
                  <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                    {checkError ? <li>{checkError}</li> : null}
                    {allProblems.map((problem) => (
                      <li key={problem.code}>{problem.message}</li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    disabled={busy}
                    onClick={() =>
                      setPreflightAttempt((attempt) => attempt + 1)
                    }
                  >
                    Check again
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Check className="size-4 shrink-0 text-[color:var(--success)]" />
                <p>
                  Up to{" "}
                  <span className="font-medium tabular-nums">
                    {info?.recipients}
                  </span>{" "}
                  contacts{info?.segmentName ? ` in ${info.segmentName}` : ""}.
                </p>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Counts use the last audience sync. Topic preferences and delivery
            suppressions can reduce the final recipient count.
          </p>
          <fieldset
            disabled={busy}
            className="grid min-w-0 gap-4 sm:grid-cols-2"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-segment">Segment</Label>
              <Select
                value={segmentId || NO_OVERRIDE}
                onValueChange={(value) =>
                  form.setValue("segmentId", value === NO_OVERRIDE ? "" : value)
                }
              >
                <SelectTrigger id="schedule-segment" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_OVERRIDE}>
                    Configured default
                  </SelectItem>
                  {segmentId &&
                  !segments.some((segment) => segment.id === segmentId) ? (
                    <SelectItem value={segmentId}>
                      Saved segment ({segmentId})
                    </SelectItem>
                  ) : null}
                  {segments.map((segment) => (
                    <SelectItem key={segment.id} value={segment.id}>
                      {segment.name}
                      {segment.isDefault ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-topic">Topic</Label>
              <Select
                value={topicId || NO_OVERRIDE}
                onValueChange={(value) =>
                  form.setValue("topicId", value === NO_OVERRIDE ? "" : value)
                }
              >
                <SelectTrigger id="schedule-topic" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_OVERRIDE}>
                    Configured default
                  </SelectItem>
                  {topicId && !topics.some((topic) => topic.id === topicId) ? (
                    <SelectItem value={topicId}>
                      Saved topic ({topicId})
                    </SelectItem>
                  ) : null}
                  {topics.map((topic) => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {topic.name}
                      {topic.isDefault ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-from">From</Label>
              <Input
                id="schedule-from"
                {...form.register("fromAddress")}
                placeholder={defaultFrom}
                aria-invalid={!!form.formState.errors.fromAddress}
                aria-describedby={
                  form.formState.errors.fromAddress
                    ? "schedule-from-error"
                    : undefined
                }
              />
              {form.formState.errors.fromAddress ? (
                <p
                  id="schedule-from-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {form.formState.errors.fromAddress.message}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-reply-to">Reply-to</Label>
              <Input
                id="schedule-reply-to"
                type="email"
                {...form.register("replyTo")}
                placeholder="Replies go to the From address"
                aria-invalid={!!form.formState.errors.replyTo}
                aria-describedby={
                  form.formState.errors.replyTo
                    ? "schedule-reply-to-error"
                    : undefined
                }
              />
              {form.formState.errors.replyTo ? (
                <p
                  id="schedule-reply-to-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {form.formState.errors.replyTo.message}
                </p>
              ) : null}
            </div>
          </fieldset>
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-time">When</Label>
            <div className="flex flex-wrap gap-2">
              {presets().map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  size="sm"
                  variant={
                    when === localDateTime(preset.value)
                      ? "secondary"
                      : "outline"
                  }
                  disabled={busy}
                  onClick={() =>
                    form.setValue("when", localDateTime(preset.value), {
                      shouldValidate: true,
                    })
                  }
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <Input
              id="schedule-time"
              type="datetime-local"
              aria-label="Send at"
              min={localDateTime(new Date())}
              {...form.register("when")}
              disabled={busy}
              aria-invalid={!!form.formState.errors.when}
              aria-describedby={
                form.formState.errors.when ? "schedule-time-error" : undefined
              }
            />
            {form.formState.errors.when ? (
              <p
                id="schedule-time-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {form.formState.errors.when.message}
              </p>
            ) : null}
          </div>
          <DialogFooter className="sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={blocked || busy}
                >
                  <Send />
                  Send immediately instead
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {mode === "sandbox"
                      ? "Send immediately (sandbox)"
                      : `Send to ${info?.recipients ?? 0} contacts now?`}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {mode === "sandbox"
                      ? "This records the send without delivering anything."
                      : "Delivery starts right away and cannot be recalled once it has begun."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Back</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={blocked || busy}
                    onClick={() => {
                      form.setValue("when", "");
                      void form.handleSubmit((values) =>
                        submit(values, true),
                      )();
                    }}
                  >
                    {mode === "sandbox" ? "Run sandbox send" : "Send now"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button type="submit" disabled={blocked || busy || !when}>
              {busy ? "Scheduling" : "Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
