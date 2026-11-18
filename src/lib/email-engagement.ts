export const JOBBOARD_SUBMISSION_EMAIL_TYPE = "jobboard_submission_received";

export function shouldCaptureEmailEngagement(
  eventType: unknown,
  tags?: { emailType?: string[]; environment?: string[] } | null,
): boolean {
  if (eventType !== "Open" && eventType !== "Click") return false;
  const environment = tags?.environment?.[0];
  if (environment && environment !== "production") return false;
  // A personal submission notice contains a link to the recipient's private inbox.
  return !tags?.emailType?.includes(JOBBOARD_SUBMISSION_EMAIL_TYPE);
}
