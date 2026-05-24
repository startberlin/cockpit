"use client";

import { ExternalLink, Mail } from "lucide-react";
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
import { getTallyStatusAction } from "./get-tally-status-action";
import { requestTallyInviteAction } from "./request-tally-invite-action";

interface TallyDialogContentProps {
  isMember: boolean;
  inviteRequested: boolean;
  isLoading: boolean;
  onRequestInvite: () => void;
  isRequestingInvite: boolean;
}

function TallyDialogContent({
  isMember,
  inviteRequested,
  isLoading,
  onRequestInvite,
  isRequestingInvite,
}: TallyDialogContentProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col w-full items-center">
        <div className="flex flex-col p-4 border w-full mb-2">
          <div className="py-4 flex gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-[250px]" />
          </div>
          <Skeleton className="h-48 w-full" />
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

  const step1Done = isMember || inviteRequested;

  return (
    <MultiStepAccordion
      className="max-w-lg my-4"
      steps={[
        {
          title: "Request an invite",
          status: step1Done ? "complete" : "current",
          content: (
            <Empty className="h-full bg-gray-50 ring-1 ring-inset ring-gray-200">
              <EmptyHeader>
                <EmptyMedia variant="default">
                  <Mail />
                </EmptyMedia>
                <EmptyTitle className="text-sm">Get access to Tally</EmptyTitle>
                <EmptyDescription>
                  Request an invite to the START Berlin Tally workspace. The
                  invite will be sent to your START Berlin email address.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRequestInvite}
                  disabled={isRequestingInvite}
                >
                  <Mail />
                  {isRequestingInvite ? "Sending invite…" : "Request invite"}
                </Button>
              </EmptyContent>
            </Empty>
          ),
        },
        {
          title: "Sign in to Tally",
          status: step1Done ? "current" : "upcoming",
          content: (
            <Empty className="h-full bg-gray-50 ring-1 ring-inset ring-gray-200">
              <EmptyHeader>
                <EmptyMedia variant="default">
                  <ExternalLink />
                </EmptyMedia>
                <EmptyTitle className="text-sm">Sign in with Google</EmptyTitle>
                <EmptyDescription>
                  Open Tally and sign in with your START Berlin Google account.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href="https://tally.so/login"
                    target="_blank"
                    data-ph-capture-attribute-service="tally"
                  >
                    <ExternalLink />
                    Open Tally
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

export function TallyDialog({
  actionLabel = "Open",
}: {
  actionLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [inviteRequested, setInviteRequested] = useState(false);

  const {
    execute: checkStatus,
    result,
    status,
    reset,
  } = useAction(getTallyStatusAction, {
    onError: handleError,
  });

  const { execute: requestInvite, status: inviteStatus } = useAction(
    requestTallyInviteAction,
    {
      onSuccess: () => setInviteRequested(true),
      onError: handleError,
    },
  );

  useEventListener("focus", () => {
    if (!open) return;
    checkStatus();
  });

  const onOpenChange = (next: boolean) => {
    setOpen(next);

    if (next && result.data === undefined) {
      checkStatus();
    }

    if (!next) {
      reset();
      setInviteRequested(false);
    }
  };

  const isMember = result.data?.isMember ?? false;
  const isLoading = status === "executing" || status === "idle";
  const isRequestingInvite = inviteStatus === "executing";

  const title = `${actionLabel} Tally`;
  const description =
    "Access START Berlin's Tally workspace for forms and surveys.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {title}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <TallyDialogContent
          isMember={isMember}
          inviteRequested={inviteRequested}
          isLoading={isLoading}
          onRequestInvite={() => requestInvite()}
          isRequestingInvite={isRequestingInvite}
        />
      </DialogContent>
    </Dialog>
  );
}
