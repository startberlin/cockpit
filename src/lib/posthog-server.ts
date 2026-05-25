import { PostHog } from "posthog-node";
import { env } from "@/env";

const token = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
if (!token) {
  console.warn(
    "PostHog disabled: NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set",
  );
}

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  if (!token) return null;
  if (!posthogClient) {
    posthogClient = new PostHog(token, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

export interface SubjectUser {
  id: string;
  status: string;
  department: string | null;
  batchNumber: number | null;
  legalMembershipState: string;
  memberSinceDate: string | null;
}

export function track(params: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}): void {
  try {
    getPostHogClient()?.capture(params);
  } catch (err) {
    console.error(`[analytics] Failed to capture ${params.event}:`, err);
  }
}

export function buildSubjectMetadata(
  user: SubjectUser,
  lastPaymentDate?: string | null,
): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    subject_id: user.id,
    subject_status: user.status,
    subject_department: user.department,
    subject_batch_number: user.batchNumber,
    subject_legal_membership_state: user.legalMembershipState,
    subject_member_since_date: user.memberSinceDate,
  };
  if (lastPaymentDate !== undefined) {
    meta.subject_last_payment_date = lastPaymentDate ?? null;
  }
  return meta;
}
