import type { NewsletterIssueStatus } from "../db/schema";

/** Resend's SDK types omit scheduled/canceled, which its API can return. */
export function broadcastStatus(
  status: string,
  scheduledAt: string | null,
  now = Date.now(),
  currentStatus?: NewsletterIssueStatus,
): NewsletterIssueStatus | null {
  switch (status) {
    case "sent":
      return "sent";
    case "scheduled":
      return "scheduled";
    case "queued":
      return scheduledAt && Date.parse(scheduledAt) > now
        ? "scheduled"
        : "sending";
    // Canceling a scheduled Resend broadcast turns it back into a remote
    // draft. Locally we preserve the attempt and offer an editable copy.
    case "draft":
      // A locally recorded draft may still be between creation and dispatch.
      // A remote draft alone cannot prove that the sending intent was canceled.
      return currentStatus === "sending" ? null : "canceled";
    case "canceled":
      return "canceled";
    default:
      return null;
  }
}
