"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type PaymentStatus =
  | "proposed"
  | "declined"
  | "pending"
  | "submitted"
  | "confirmed"
  | "paid_out"
  | "failed"
  | "cancelled"
  | "charged_back";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; variant: BadgeVariant; tooltip: string }
> = {
  proposed: {
    label: "Proposed",
    variant: "outline",
    tooltip: "Ready for your review. Charge via Direct Debit once approved.",
  },
  declined: {
    label: "Declined",
    variant: "secondary",
    tooltip: "An admin chose not to collect this payment cycle.",
  },
  pending: {
    label: "Pending",
    variant: "secondary",
    tooltip:
      "Submitted to GoCardless and queued for submission to the member's bank.",
  },
  submitted: {
    label: "Submitted",
    variant: "secondary",
    tooltip:
      "Sent to the banking network. Funds are typically collected within 1–2 business days.",
  },
  confirmed: {
    label: "Confirmed",
    variant: "default",
    tooltip:
      "Confirmed by the member's bank. Funds are on their way to START Berlin's account.",
  },
  paid_out: {
    label: "Paid out",
    variant: "default",
    tooltip: "Settled. The payment has arrived in START Berlin's bank account.",
  },
  failed: {
    label: "Failed",
    variant: "destructive",
    tooltip:
      "Rejected by the member's bank — usually due to insufficient funds or a cancelled mandate.",
  },
  cancelled: {
    label: "Cancelled",
    variant: "destructive",
    tooltip: "Cancelled before reaching the bank. No funds were collected.",
  },
  charged_back: {
    label: "Charged back",
    variant: "destructive",
    tooltip:
      "Reversed following a dispute. The member's bank returned the funds.",
  },
};

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
}

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  if (!config) return <Badge variant="outline">{status}</Badge>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={config.variant} className="cursor-default">
          {config.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-56">
        <p>{config.tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export type GcPaymentStatus =
  | "pending_submission"
  | "submitted"
  | "confirmed"
  | "paid_out"
  | "cancelled"
  | "customer_approval_denied"
  | "pending_customer_approval"
  | "failed"
  | "charged_back";

const GC_STATUS_CONFIG: Record<
  GcPaymentStatus,
  { label: string; variant: BadgeVariant; tooltip: string }
> = {
  pending_submission: {
    label: "Queued",
    variant: "secondary",
    tooltip: "Created in GoCardless — not yet sent to the banks.",
  },
  submitted: {
    label: "Submitted",
    variant: "secondary",
    tooltip:
      "Sent to the banking network. Funds are typically collected within 1–3 business days.",
  },
  confirmed: {
    label: "Confirmed",
    variant: "default",
    tooltip:
      "Collected from the member's account. Funds are on their way to START Berlin.",
  },
  paid_out: {
    label: "Paid out",
    variant: "default",
    tooltip: "Settled. The payment has arrived in START Berlin's bank account.",
  },
  cancelled: {
    label: "Cancelled",
    variant: "destructive",
    tooltip: "Cancelled before reaching the bank. No funds were collected.",
  },
  customer_approval_denied: {
    label: "Approval denied",
    variant: "destructive",
    tooltip: "The member denied authorisation — no payment was taken.",
  },
  pending_customer_approval: {
    label: "Awaiting approval",
    variant: "secondary",
    tooltip:
      "Waiting for the member to authorise the payment before it can be submitted.",
  },
  failed: {
    label: "Failed",
    variant: "destructive",
    tooltip:
      "Rejected by the member's bank — usually due to insufficient funds or a cancelled mandate.",
  },
  charged_back: {
    label: "Charged back",
    variant: "destructive",
    tooltip: "Reversed following a dispute. Funds were returned to the member.",
  },
};

interface GcPaymentStatusBadgeProps {
  status: string;
}

export function GcPaymentStatusBadge({ status }: GcPaymentStatusBadgeProps) {
  const config = GC_STATUS_CONFIG[status as GcPaymentStatus];
  if (!config) return <Badge variant="outline">{status}</Badge>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={config.variant} className="cursor-default">
          {config.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-56">
        <p>{config.tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
