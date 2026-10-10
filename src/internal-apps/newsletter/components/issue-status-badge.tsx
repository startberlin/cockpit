import { Badge } from "@/components/ui/badge";
import type { NewsletterIssueStatus } from "../db/schema";

const STATUS_LABELS: Record<NewsletterIssueStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  canceled: "Canceled",
  failed: "Failed",
};

const STATUS_VARIANTS: Record<
  NewsletterIssueStatus,
  "outline" | "secondary" | "default" | "destructive"
> = {
  draft: "outline",
  scheduled: "secondary",
  sending: "secondary",
  sent: "default",
  canceled: "outline",
  failed: "destructive",
};

export function IssueStatusBadge({
  status,
  sandbox = false,
}: {
  status: NewsletterIssueStatus;
  sandbox?: boolean;
}) {
  return (
    <Badge variant={STATUS_VARIANTS[status]}>
      {STATUS_LABELS[status]}
      {sandbox ? " (sandbox)" : ""}
    </Badge>
  );
}

export { STATUS_LABELS };
