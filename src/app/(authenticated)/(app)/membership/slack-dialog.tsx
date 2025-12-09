"use client";

import { ExternalLink, UserPlus } from "lucide-react";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { useEventListener, useMediaQuery } from "usehooks-ts";
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
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
}

function SlackDialogContent({ exists, isLoading }: SlackDialogContentProps) {
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
                    href="https://start-berlin-slack.slack.com/signup#/domain-signup"
                    target="_blank"
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
                  Open Slack to stay updated with the latest news and
                  announcements.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href="https://start-berlin-slack.slack.com"
                    target="_blank"
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

export function SlackDialog() {
  const [open, setOpen] = useState(false);

  const { execute, result, status, reset } = useAction(getSlackStatusAction, {
    onError: handleError,
  });

  const isDesktop = useMediaQuery("(min-width: 768px)");

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

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button variant="default">Join Slack</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Slack</DialogTitle>
            <DialogDescription>
              Set up your Slack account to stay updated with the latest news and
              announcements.
            </DialogDescription>
          </DialogHeader>
          <SlackDialogContent
            exists={exists}
            isLoading={isLoading}
            isError={isError}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="default">Join Slack</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Join Slack</DrawerTitle>
          <DrawerDescription>
            Set up your Slack account to stay updated with the latest news and
            announcements.
          </DrawerDescription>
        </DrawerHeader>

        <SlackDialogContent
          exists={exists}
          isLoading={isLoading}
          isError={isError}
        />
      </DrawerContent>
    </Drawer>
  );
}
