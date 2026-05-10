"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
} from "@/db/schema/board-admission";
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
    case "abstain":
      return "Abstain";
    case "procedure_objection":
      return "Procedure Objection";
  }
}

const VOTE_BUTTONS: {
  value: BoardVoteValue;
  label: string;
  variant: "default" | "destructive" | "outline" | "secondary";
}[] = [
  { value: "yes", label: "Yes", variant: "default" },
  { value: "no", label: "No", variant: "destructive" },
  { value: "abstain", label: "Abstain", variant: "outline" },
  {
    value: "procedure_objection",
    label: "Procedure Objection",
    variant: "secondary",
  },
];

interface ResolutionVoteClientProps {
  resolution: ResolutionDetail;
  currentUserId: string;
}

export default function ResolutionVoteClient({
  resolution,
  currentUserId,
}: ResolutionVoteClientProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const currentParticipant = resolution.participants.find(
    (p) => p.userId === currentUserId,
  );
  const hasVoted = currentParticipant?.vote != null;
  const canVote = !hasVoted && resolution.status === "admission_pending";

  const allVoted = resolution.participants.every((p) => p.vote != null);

  async function handleVote(value: BoardVoteValue) {
    setIsPending(true);
    try {
      const result = await castVoteAction({
        resolutionId: resolution.resolutionId,
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
      router.push("/people?view=actions");
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Board Resolution</h1>
        <p className="text-muted-foreground mt-1">
          Admission vote for{" "}
          <span className="font-medium text-foreground">
            {resolution.subject.name}
          </span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resolution Text</CardTitle>
          <CardDescription>
            You are voting on the following resolution. The hash below ensures
            you are seeing the canonical text.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed border rounded-md p-4 bg-muted/50">
            {resolution.resolutionText}
          </p>
          <p className="text-xs text-muted-foreground font-mono break-all">
            SHA-256: {resolution.resolutionTextHash}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Board Vote Status</CardTitle>
        </CardHeader>
        <CardContent>
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
                  // All votes are in — reveal everyone's vote
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
        </CardContent>
      </Card>

      {resolution.status !== "admission_pending" && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Voting is closed for this resolution. Current status:{" "}
              <span className="font-medium text-foreground">
                {resolution.status.replace(/_/g, " ")}
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      {resolution.status === "admission_pending" && hasVoted && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              You have already submitted your vote for this resolution.
            </p>
          </CardContent>
        </Card>
      )}

      {canVote && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cast Your Vote</CardTitle>
            <CardDescription>
              Your vote is final and cannot be changed after submission.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
