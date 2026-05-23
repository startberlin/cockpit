"use client";

import { ExternalLink, TriangleAlert, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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

export function CanvaDialog({
  actionLabel = "Open",
}: {
  actionLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);

  const title = `${actionLabel} Canva`;
  const description = "Access the START Berlin Canva team for design work.";

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setUnderstood(false);
  };

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
        <MultiStepAccordion
          className="max-w-lg my-4"
          steps={[
            {
              title: "Limited seats available",
              status: understood ? "complete" : "current",
              content: (
                <Empty className="h-full bg-gray-50 ring-1 ring-inset ring-gray-200">
                  <EmptyHeader>
                    <EmptyMedia variant="default">
                      <TriangleAlert />
                    </EmptyMedia>
                    <EmptyTitle className="text-sm">
                      Limited seats available
                    </EmptyTitle>
                    <EmptyDescription>
                      Our Canva licence covers 50 seats. Please only join Canva
                      for START Berlin tasks such as social media posts,
                      partnership slide decks, internal presentations, or
                      similar work.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUnderstood(true)}
                    >
                      I understand
                    </Button>
                  </EmptyContent>
                </Empty>
              ),
            },
            {
              title: "Sign in to Canva",
              status: understood ? "current" : "upcoming",
              content: (
                <Empty className="h-full bg-gray-50 ring-1 ring-inset ring-gray-200">
                  <EmptyHeader>
                    <EmptyMedia variant="default">
                      <UserPlus />
                    </EmptyMedia>
                    <EmptyTitle className="text-sm">
                      Sign in with Google
                    </EmptyTitle>
                    <EmptyDescription>
                      Create a Canva account by signing in with Google. Use your
                      START Berlin Google account to be automatically added to
                      the START Berlin Canva team.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="https://www.canva.com/signup" target="_blank">
                        <ExternalLink />
                        Open Canva
                      </Link>
                    </Button>
                  </EmptyContent>
                </Empty>
              ),
            },
          ]}
        />
      </DialogContent>
    </Dialog>
  );
}
