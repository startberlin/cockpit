"use client";

import { ExternalLink, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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

export function NotionDialog({
  actionLabel = "Join",
}: {
  actionLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  const title = `${actionLabel} Notion`;
  const description =
    actionLabel === "Join"
      ? "Join Notion to access START Berlin resources, project docs, and internal information."
      : "Open Notion to access START Berlin resources, project docs, and internal information.";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-ph-capture-attribute-service="notion"
        >
          {title}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Empty className="h-full bg-gray-50 ring-1 ring-inset ring-gray-200 my-4">
          <EmptyHeader>
            <EmptyMedia variant="default">
              <UserPlus />
            </EmptyMedia>
            <EmptyTitle className="text-sm">Sign in with Google</EmptyTitle>
            <EmptyDescription>
              Create a Notion account by signing in with Google. Use your START
              Berlin Google account to be automatically added to the START
              Berlin Notion workspace.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" asChild>
              <Link
                href="https://www.notion.so/start-berlin"
                target="_blank"
                rel="noopener noreferrer"
                data-ph-capture-attribute-service="notion"
              >
                <ExternalLink />
                Open Notion
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      </DialogContent>
    </Dialog>
  );
}
