"use client";

import { ExternalLink, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useMediaQuery } from "usehooks-ts";
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

export function NotionDialog({
  actionLabel = "Join",
}: {
  actionLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  const isDesktop = useMediaQuery("(min-width: 768px)", {
    initializeWithValue: false,
  });
  const title = `${actionLabel} Notion`;
  const description =
    actionLabel === "Join"
      ? "Join Notion to access START Berlin resources, project docs, and internal information."
      : "Open Notion to access START Berlin resources, project docs, and internal information.";

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="default">{title}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Empty className="h-full bg-gray-50 ring-1 ring-inset ring-gray-200">
            <EmptyHeader>
              <EmptyMedia variant="default">
                <UserPlus />
              </EmptyMedia>
              <EmptyTitle className="text-sm">Sign in with Google</EmptyTitle>
              <EmptyDescription>
                Create a Notion account by signing in with Google. Use your
                START Berlin Google account to be automatically added to the
                START Berlin Notion workspace.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" asChild>
                <Link href="https://www.notion.so/start-berlin" target="_blank">
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

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="default">{title}</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>

        <Empty className="h-full bg-gray-50 ring-1 ring-inset ring-gray-200">
          <EmptyHeader>
            <EmptyMedia variant="default">
              <UserPlus />
            </EmptyMedia>
            <EmptyTitle className="text-sm">Sign in with Google</EmptyTitle>
            <EmptyDescription>
              Create a Notion account by signing in with Google. Use your START
              Berlin Google account.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" asChild>
              <Link
                href="https://start-berlin-notion.notion.com/signup#/domain-signup"
                target="_blank"
              >
                <ExternalLink />
                Open Notion
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      </DrawerContent>
    </Drawer>
  );
}
