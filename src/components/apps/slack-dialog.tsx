"use client";

import { ExternalLink, RotateCw, TriangleAlert, UserPlus } from "lucide-react";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { useEventListener } from "usehooks-ts";
import MultiStepAccordion from "@/components/multi-step-accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { handleError } from "@/lib/utils";
import { getSlackStatusAction } from "./get-slack-status-action";

interface SlackDialogContentProps {
  exists: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  actionLabel: string;
}

function SlackDialogContent({
  exists,
  isLoading,
  isError,
  onRetry,
  actionLabel,
}: SlackDialogContentProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col w-full items-center">
        <div className="flex flex-col p-4 border w-full mb-2">
          <div className="py-4 flex gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-[250px]" />
          </div>
          <Skeleton className="h-60 w-full" />
        </div>
        <div className="flex flex-col p-4 border w-full">
          <div className="py-4 flex gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-[250px]" />
          </div>
        </div>
      </div>
    );
  }

  // A failed lookup means we do not know whether the account exists, so showing
  // the "create an account" step would be misleading for existing members.
  if (isError) {
    return (
      <Empty className="my-4 h-full bg-gray-50 ring-1 ring-inset ring-gray-200">
        <EmptyHeader>
          <EmptyMedia variant="default">
            <TriangleAlert />
          </EmptyMedia>
          <EmptyTitle className="text-sm">
            Could not check your Slack account
          </EmptyTitle>
          <EmptyDescription>
            We could not reach Slack just now. Try again, or open Slack
            directly.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCw />
              Try again
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link
                href="https://start-berlin-e-v.slack.com"
                target="_blank"
                rel="noopener noreferrer"
                data-ph-capture-attribute-service="slack"
              >
                <ExternalLink />
                Open Slack
              </Link>
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <MultiStepAccordion
      className="max-w-lg my-4"
      steps={[
        {
          title: "Create a Slack account",
          status: exists ? "complete" : "current",
          content: (
            <Empty className="h-full bg-gray-50 ring-1 ring-inset ring-gray-200">
              <EmptyHeader>
                <EmptyMedia variant="default">
                  <UserPlus />
                </EmptyMedia>
                <EmptyTitle className="text-sm">Sign in with Google</EmptyTitle>
                <EmptyDescription>
                  Create a Slack account by signing in with Google. Use your
                  START Berlin Google account.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href="https://start-berlin-e-v.slack.com/signup#/domain-signup"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-ph-capture-attribute-service="slack"
                  >
                    <ExternalLink />
                    Open Slack
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          ),
        },
        {
          title: "Open Slack",
          status: exists ? "current" : "upcoming",
          content: (
            <Empty className="h-full bg-gray-50 ring-1 ring-inset ring-gray-200">
              <EmptyHeader>
                <EmptyMedia variant="default">
                  <ExternalLink />
                </EmptyMedia>
                <EmptyTitle className="text-sm">Open Slack</EmptyTitle>
                <EmptyDescription>
                  {actionLabel === "Join"
                    ? "Join Slack for START Berlin communication, updates, and day-to-day coordination."
                    : "Open Slack for START Berlin communication, updates, and day-to-day coordination."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href="https://start-berlin-e-v.slack.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-ph-capture-attribute-service="slack"
                  >
                    <ExternalLink />
                    Open Slack
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          ),
        },
      ]}
    />
  );
}

export function SlackDialog({
  actionLabel = "Join",
}: {
  actionLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  const { execute, result, status, reset } = useAction(getSlackStatusAction, {
    onError: handleError,
  });

  useEventListener("focus", () => {
    if (!open) return;
    execute();
  });

  const onOpenChange = (next: boolean) => {
    setOpen(next);

    if (next && result.data === undefined) {
      execute();
    }

    if (!next) {
      reset();
    }
  };

  const exists = result.data?.exists ?? false;
  const isLoading = status === "executing" || status === "idle";
  const isError = !!result.serverError;
  const title = `${actionLabel} Slack`;
  const description =
    actionLabel === "Join"
      ? "Join Slack for START Berlin communication, updates, and day-to-day coordination."
      : "Open Slack for START Berlin communication, updates, and day-to-day coordination.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-ph-capture-attribute-service="slack"
        >
          {title}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <SlackDialogContent
          exists={exists}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => execute()}
          actionLabel={actionLabel}
        />
      </DialogContent>
    </Dialog>
  );
}
