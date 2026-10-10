"use client";

import { Copy, RefreshCw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { duplicateIssueAction } from "../actions/issues";
import { cancelIssueAction } from "../actions/send";
import type { NewsletterIssueStatus } from "../db/schema";
import { parseError } from "../lib/error";
import { ScheduleDialog } from "./schedule-dialog";
import { SendTestDialog } from "./send-test-dialog";

export interface SendingOption {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface IssueSendingSettings {
  fromAddress: string | null;
  replyTo: string | null;
  segmentId: string | null;
  topicId: string | null;
}

export function IssueActions({
  issueId,
  status,
  mode,
  defaultTestRecipient,
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
  status: NewsletterIssueStatus;
  mode: "sandbox" | "live";
  defaultTestRecipient: string;
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
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const cancel = useAction(cancelIssueAction, {
    onSuccess: () => {
      setCancelOpen(false);
      toast.success("Send canceled. Use Edit a copy to prepare a new draft.");
      router.refresh();
    },
    onError: ({ error }) => toast.error(parseError(error)),
  });
  const duplicate = useAction(duplicateIssueAction, {
    onSuccess: ({ data }) => {
      if (data?.id) router.push(`/newsletter/issues/${data.id}`);
    },
    onError: ({ error }) => toast.error(parseError(error)),
  });
  const inFlight = status === "scheduled" || status === "sending";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SendTestDialog
        issueId={issueId}
        defaultRecipient={defaultTestRecipient}
        beforeAction={beforeAction}
        getRevision={getRevision}
      />
      {status === "draft" ? (
        <ScheduleDialog
          issueId={issueId}
          mode={mode}
          subject={subject}
          previewText={previewText}
          settings={settings}
          segments={segments}
          topics={topics}
          defaultFrom={defaultFrom}
          beforeAction={beforeAction}
          getRevision={getRevision}
        />
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={duplicate.isPending || cancel.isPending}
          onClick={() => duplicate.execute({ id: issueId })}
        >
          <Copy />
          Edit a copy
        </Button>
      )}
      {inFlight ? (
        <>
          <AlertDialog
            open={cancelOpen}
            onOpenChange={(value) => !cancel.isPending && setCancelOpen(value)}
          >
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={cancel.isPending}>
                <XCircle />
                Cancel send
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this send?</AlertDialogTitle>
                <AlertDialogDescription>
                  The issue will be canceled. Messages already delivered cannot
                  be recalled. Use Edit a copy to prepare another draft.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={cancel.isPending}>
                  Keep sending
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={cancel.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    if (!cancel.isPending) cancel.execute({ id: issueId });
                  }}
                >
                  {cancel.isPending ? "Canceling" : "Cancel send"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Refresh sending status"
            disabled={refreshing || cancel.isPending}
            onClick={() => startRefresh(() => router.refresh())}
          >
            <RefreshCw className={refreshing ? "animate-spin" : undefined} />
          </Button>
        </>
      ) : null}
    </div>
  );
}
