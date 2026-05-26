"use client";

import { ArrowLeftIcon, CircleXIcon, InfoIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import type { UserStatus } from "@/db/schema/auth";
import type { MembershipTransitionRequest } from "@/db/schema/membership-transition-request";
import { approveAlumniAction } from "./approve-alumni-action";

interface SubjectUser {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
}

interface ApproveAlumniClientProps {
  request: MembershipTransitionRequest;
  subjectUser: SubjectUser;
  canAct: boolean;
}

function AlumniRequestForm({
  request,
  subjectUser,
  isPending,
  onApprove,
  onReject,
}: {
  request: MembershipTransitionRequest;
  subjectUser: SubjectUser;
  isPending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmedIrreversible, setConfirmedIrreversible] = useState(false);
  const [confirmedDeletion, setConfirmedDeletion] = useState(false);

  if (step === 1) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/25 bg-destructive/8 p-4 space-y-4">
          <p className="text-sm font-medium">
            What approving this request means
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CircleXIcon className="size-4 mt-0.5 shrink-0 text-destructive/60" />
              <span>
                {subjectUser.name}&apos;s membership will end immediately.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CircleXIcon className="size-4 mt-0.5 shrink-0 text-destructive/60" />
              <span>
                Their Google Workspace account ({subjectUser.email}) will be
                suspended and permanently deleted after 7 days.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CircleXIcon className="size-4 mt-0.5 shrink-0 text-destructive/60" />
              <span>All START Berlin access will be revoked.</span>
            </li>
          </ul>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onReject} disabled={isPending}>
            Reject
          </Button>
          <Button variant="destructive" onClick={() => setStep(2)}>
            Continue to approve
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FieldSet>
        <FieldGroup>
          <Field orientation="horizontal" className="items-start">
            <Checkbox
              id="confirmedIrreversible"
              checked={confirmedIrreversible}
              onCheckedChange={(checked) =>
                setConfirmedIrreversible(checked === true)
              }
              disabled={isPending}
            />
            <FieldLabel htmlFor="confirmedIrreversible">
              I understand that this action is irreversible and will end{" "}
              {subjectUser.name}&apos;s membership.
            </FieldLabel>
          </Field>
          <Field orientation="horizontal" className="items-start">
            <Checkbox
              id="confirmedDeletion"
              checked={confirmedDeletion}
              onCheckedChange={(checked) =>
                setConfirmedDeletion(checked === true)
              }
              disabled={isPending}
            />
            <FieldLabel htmlFor="confirmedDeletion">
              I understand that their Google Workspace account (
              {subjectUser.email}) will be permanently deleted after 7 days.
            </FieldLabel>
          </Field>
        </FieldGroup>
      </FieldSet>
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => setStep(1)}
          disabled={isPending}
        >
          Back
        </Button>
        <Button
          variant="destructive"
          disabled={!confirmedIrreversible || !confirmedDeletion || isPending}
          onClick={onApprove}
        >
          {isPending ? "Approving…" : "Confirm approval"}
        </Button>
      </div>
    </div>
  );
}

function AlumniDepartureAcknowledgementForm({
  subjectUser,
  isPending,
  onAcknowledge,
}: {
  subjectUser: SubjectUser;
  isPending: boolean;
  onAcknowledge: () => void;
}) {
  return (
    <div className="space-y-6">
      <Alert>
        <InfoIcon />
        <AlertTitle>No approval needed</AlertTitle>
        <AlertDescription>
          {subjectUser.name} is already a Supporting Alumni, so this transition
          does not require board approval. It will auto-confirm 7 days after
          submission. Acknowledge to process it immediately.
        </AlertDescription>
      </Alert>
      <div className="rounded-lg border border-destructive/25 bg-destructive/8 p-4 space-y-4">
        <p className="text-sm font-medium">
          What acknowledging this request means
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CircleXIcon className="size-4 mt-0.5 shrink-0 text-destructive/60" />
            <span>
              {subjectUser.name}&apos;s Supporting Alumni membership will end
              immediately.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CircleXIcon className="size-4 mt-0.5 shrink-0 text-destructive/60" />
            <span>
              Their Google Workspace account ({subjectUser.email}) will be
              suspended and permanently deleted after 7 days.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CircleXIcon className="size-4 mt-0.5 shrink-0 text-destructive/60" />
            <span>All START Berlin access will be revoked.</span>
          </li>
        </ul>
      </div>
      <div className="flex gap-3">
        <Button onClick={onAcknowledge} disabled={isPending}>
          {isPending ? "Acknowledging…" : "Acknowledge and process now"}
        </Button>
      </div>
    </div>
  );
}

export default function ApproveAlumniClient({
  request,
  subjectUser,
  canAct,
}: ApproveAlumniClientProps) {
  const router = useRouter();

  const { execute, isPending } = useAction(approveAlumniAction, {
    onSuccess: () => {
      toast.success("Decision recorded.");
      router.push("/admin/tasks");
    },
    onError: ({ error }) => {
      toast.error(
        error.serverError ?? "Failed to record decision. Please try again.",
      );
    },
  });

  const isSupportingAlumniDeparture =
    request.type === "alumni_request" &&
    subjectUser.status === "supporting_alumni";

  const transitionLabel =
    request.type === "alumni_request" ? "Alumni" : "Supporting Alumni";

  const heading = isSupportingAlumniDeparture
    ? "Alumni Departure"
    : `${transitionLabel} Request`;
  const subheading = isSupportingAlumniDeparture
    ? `${subjectUser.name} is currently a Supporting Alumni and has requested to become a full Alumni.`
    : `${subjectUser.name} has requested to become a ${transitionLabel.toLowerCase()} member.`;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
          <Link href="/admin/tasks">
            <ArrowLeftIcon className="size-4" />
            Tasks
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        <p className="text-sm text-muted-foreground mt-1">{subheading}</p>
      </div>

      <div className="grid grid-cols-3 overflow-hidden rounded-lg border">
        <div className="px-4 py-3 border-r">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Member
          </p>
          <p className="mt-0.5 text-sm font-medium">{subjectUser.name}</p>
        </div>
        <div className="px-4 py-3 border-r">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Type
          </p>
          <p className="mt-0.5 text-sm font-medium">{transitionLabel}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Submitted
          </p>
          <p className="mt-0.5 text-sm font-medium">
            {request.requestedAt.toLocaleDateString("en-GB", {
              dateStyle: "medium",
            })}
          </p>
        </div>
      </div>

      {!canAct && (
        <p className="text-sm text-muted-foreground">
          You have view-only access to this request.
        </p>
      )}

      {canAct && isSupportingAlumniDeparture && (
        <AlumniDepartureAcknowledgementForm
          subjectUser={subjectUser}
          isPending={isPending}
          onAcknowledge={() =>
            execute({
              transitionRequestId: request.id,
              decision: "acknowledged",
            })
          }
        />
      )}

      {canAct &&
        request.type === "alumni_request" &&
        !isSupportingAlumniDeparture && (
          <AlumniRequestForm
            request={request}
            subjectUser={subjectUser}
            isPending={isPending}
            onApprove={() =>
              execute({ transitionRequestId: request.id, decision: "approved" })
            }
            onReject={() =>
              execute({ transitionRequestId: request.id, decision: "rejected" })
            }
          />
        )}

      {canAct && request.type === "supporting_alumni_request" && (
        <div className="flex gap-3">
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() =>
              execute({ transitionRequestId: request.id, decision: "rejected" })
            }
          >
            Reject
          </Button>
          <Button
            disabled={isPending}
            onClick={() =>
              execute({ transitionRequestId: request.id, decision: "approved" })
            }
          >
            {isPending ? "Saving…" : "Approve"}
          </Button>
        </div>
      )}
    </div>
  );
}
