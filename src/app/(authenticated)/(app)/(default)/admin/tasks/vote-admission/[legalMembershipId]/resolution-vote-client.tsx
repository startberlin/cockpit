"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ResolutionDetail } from "@/db/board-resolutions";
import type {
  BoardVoteValue,
  OfficerFunction,
} from "@/db/schema/legal-membership";
import { computeResolutionRoles } from "@/lib/board-resolution-rules";
import { castVoteAction } from "./vote-action";

function officerFunctionLabel(fn: OfficerFunction): string {
  switch (fn) {
    case "president":
      return "President";
    case "vice_president":
      return "Vice President";
    case "head_of_finance":
      return "Head of Finance";
  }
}

function voteValueLabel(value: BoardVoteValue): string {
  switch (value) {
    case "yes":
      return "Yes";
    case "no":
      return "No";
  }
}

const VOTE_BUTTONS: {
  value: BoardVoteValue;
  label: string;
  variant: "default" | "destructive";
}[] = [
  { value: "yes", label: "Yes", variant: "default" },
  { value: "no", label: "No", variant: "destructive" },
];

interface ResolutionVoteClientProps {
  resolution: ResolutionDetail;
  currentUserId: string;
  isParticipant: boolean;
}

export default function ResolutionVoteClient({
  resolution,
  currentUserId,
  isParticipant,
}: ResolutionVoteClientProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const currentParticipant = resolution.participants.find(
    (p) => p.userId === currentUserId,
  );
  const hasVoted = currentParticipant?.vote != null;
  const canVote =
    isParticipant && !hasVoted && resolution.status === "admission_pending";

  const allVoted = resolution.participants.every((p) => p.vote != null);

  const resolutionVotes = resolution.participants.flatMap((p) =>
    p.vote != null ? [{ voterUserId: p.userId, value: p.vote.value }] : [],
  );

  const roles =
    resolution.status !== "admission_pending"
      ? computeResolutionRoles(resolution.participants, resolutionVotes)
      : null;

  async function handleVote(value: BoardVoteValue) {
    setIsPending(true);
    try {
      const result = await castVoteAction({
        legalMembershipId: resolution.legalMembershipId,
        value,
        displayedResolutionHash: resolution.resolutionTextHash,
      });

      if (result?.serverError) {
        toast.error(result.serverError);
        return;
      }

      if (result?.validationErrors) {
        toast.error("Invalid input. Please try again.");
        return;
      }

      toast.success("Vote recorded.");
      router.push("/admin/tasks");
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  const statusLabel =
    resolution.status === "admission_pending"
      ? "Pending"
      : resolution.status.replace(/_/g, " ");

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
          <Link href="/admin/tasks">
            <ArrowLeftIcon className="size-4" />
            Tasks
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Board Resolution
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Admission vote for{" "}
          <span className="font-medium text-foreground">
            {resolution.subject.name}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-lg border">
        <div className="px-4 py-3 border-r">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Member
          </p>
          <p className="mt-0.5 text-sm font-medium">
            {resolution.subject.name}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Status
          </p>
          <p className="mt-0.5 text-sm font-medium capitalize">{statusLabel}</p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Resolution Text</p>
        <p className="text-xs text-muted-foreground">
          You are voting on the following resolution. The hash below ensures you
          are seeing the canonical text.
        </p>
        <p className="text-sm leading-relaxed border rounded-md p-4 bg-muted/50">
          {resolution.resolutionText}
        </p>
        <p className="text-xs text-muted-foreground font-mono break-all">
          SHA-256: {resolution.resolutionTextHash}
        </p>
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="text-sm font-semibold">Board Vote Status</p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Officer</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resolution.participants.map((participant) => {
                const isCurrentUser = participant.userId === currentUserId;

                let statusCell: React.ReactNode;
                if (participant.vote == null) {
                  statusCell = (
                    <span className="text-muted-foreground text-sm">
                      Pending
                    </span>
                  );
                } else if (isCurrentUser) {
                  statusCell = (
                    <Badge variant="secondary">
                      You voted: {voteValueLabel(participant.vote.value)}
                    </Badge>
                  );
                } else if (allVoted) {
                  statusCell = (
                    <Badge variant="outline">
                      {voteValueLabel(participant.vote.value)}
                    </Badge>
                  );
                } else {
                  statusCell = <Badge variant="secondary">Voted</Badge>;
                }

                return (
                  <TableRow key={participant.userId}>
                    <TableCell className="text-sm">
                      {officerFunctionLabel(participant.officerFunction)}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {participant.name}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{statusCell}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {roles && (
        <>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
                Sitzungsleiter
              </p>
              <p className="text-sm font-medium">
                {resolution.participants.find(
                  (p) => p.userId === roles.sitzungsleiter.userId,
                )?.name ?? roles.sitzungsleiter.userId}{" "}
                <span className="font-normal text-muted-foreground">
                  ({officerFunctionLabel(roles.sitzungsleiter.officerFunction)})
                </span>
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
                Protokollführer
              </p>
              <p className="text-sm font-medium">
                {resolution.participants.find(
                  (p) => p.userId === roles.protokollfuehrer.userId,
                )?.name ?? roles.protokollfuehrer.userId}{" "}
                <span className="font-normal text-muted-foreground">
                  (
                  {officerFunctionLabel(roles.protokollfuehrer.officerFunction)}
                  )
                </span>
              </p>
            </div>
          </div>
        </>
      )}

      {resolution.status !== "admission_pending" && (
        <p className="text-sm text-muted-foreground">
          Voting is closed for this resolution. Current status:{" "}
          <span className="font-medium text-foreground capitalize">
            {statusLabel}
          </span>
        </p>
      )}

      {resolution.status === "admission_pending" &&
        isParticipant &&
        hasVoted && (
          <p className="text-sm text-muted-foreground">
            You have already submitted your vote for this resolution.
          </p>
        )}

      {canVote && (
        <>
          <Separator />
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold">Cast Your Vote</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your vote is final and cannot be changed after submission.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {VOTE_BUTTONS.map(({ value, label, variant }) => (
                <Button
                  key={value}
                  variant={variant}
                  disabled={isPending}
                  onClick={() => handleVote(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
