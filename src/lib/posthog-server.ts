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

export interface SubjectProperties {
  subject_id: string;
  subject_status: string;
  subject_department: string | null;
  subject_batch_number: number | null;
  subject_legal_membership_state: string;
  subject_member_since_date: string | null;
  subject_last_payment_date?: string | null;
}

export interface SubjectUser {
  id: string;
  status: string;
  department: string | null;
  batchNumber: number | null;
  legalMembershipState: string;
  memberSinceDate: string | null;
}

type MembershipTransitionType =
  | "cancellation"
  | "alumni_request"
  | "supporting_alumni_request";

type WorkflowEmailType =
  | "mandate_setup_reminder"
  | "mandate_setup_abandonment_reminder"
  | "membership_application_submitted"
  | "membership_admission_confirmed"
  | "membership_cancelled"
  | "welcome"
  | "membership_transition_expired"
  | "membership_transition_rejected"
  | "membership_transition_supporting_alumni"
  | "membership_transition_alumni"
  | "reconfirmation_reminder"
  | "data_confirmation_reminder"
  | "reconfirmation_abandonment_reminder"
  | "application_resume_reminder";

type TrackingEvent =
  // Onboarding
  | {
      event: "onboarding_master_data_submitted";
      properties: {
        had_personal_email: boolean;
        had_phone: boolean;
        had_birth_date: boolean;
      };
    }
  | {
      event: "onboarding_email_preference_selected";
      properties: { preference: "personal_email" | "start_email" | "custom" };
    }
  | { event: "onboarding_completed" }
  // Profile
  | { event: "profile_updated"; properties: { changed_fields: string[] } }
  // Membership application
  | {
      event: "membership_application_step_completed";
      properties: {
        step: "identity" | "personal-information" | "fees" | "bylaws";
      };
    }
  | { event: "membership_application_submitted" }
  // Membership transitions
  | {
      event: "membership_transition_requested";
      properties: {
        transition_type: "alumni_request" | "supporting_alumni_request";
        had_reason: boolean;
      };
    }
  | {
      event: "membership_transition_retracted";
      properties: { transition_type: MembershipTransitionType | null };
    }
  // Payments
  | { event: "payment_setup_started" }
  | { event: "payment_mandate_returned"; properties: { success: boolean } }
  | { event: "payment_mandate_confirmed" }
  | {
      event: "admin_payment_charged";
      properties: {
        actor_id: string;
        payment_amount_cents: number;
      } & SubjectProperties;
    }
  | {
      event: "admin_payment_declined";
      properties: {
        actor_id: string;
        payment_amount_cents: number;
      } & SubjectProperties;
    }
  // Admin — users
  | {
      event: "admin_user_created";
      properties: {
        actor_id: string;
        company_email: string;
        status: string;
        department: string | null;
        batch_number: number | null;
      };
    }
  | {
      event: "admin_user_updated";
      properties: {
        actor_id: string;
        company_email: string;
        status: string;
        department: string | null;
        batch_number: number | null;
      };
    }
  | {
      event: "admin_user_imported";
      properties: { actor_id: string } & SubjectProperties;
    }
  | {
      event: "admin_user_removed";
      properties: { actor_id: string } & SubjectProperties;
    }
  | {
      event: "admin_permissions_updated";
      properties: {
        actor_id: string;
        permissions_added: string[];
        permissions_removed: string[];
      } & SubjectProperties;
    }
  | {
      event: "admin_membership_proposed";
      properties: { actor_id: string } & SubjectProperties;
    }
  | {
      event: "admin_user_department_changed";
      properties: {
        actor_id: string;
        old_department: string | null;
        new_department: string;
      } & SubjectProperties;
    }
  | {
      event: "admin_user_personal_email_changed";
      properties: { actor_id: string } & SubjectProperties;
    }
  | {
      event: "admin_user_password_reset";
      properties: { actor_id: string } & SubjectProperties;
    }
  // Admin — batches
  | {
      event: "admin_batch_created";
      properties: { actor_id: string; batch_number: number };
    }
  | {
      event: "admin_batch_updated";
      properties: {
        actor_id: string;
        batch_number: number;
        fields_changed: string[];
      };
    }
  // Groups
  | {
      event: "group_created";
      properties: { has_email_integration: boolean };
    }
  | {
      event: "group_member_added";
      properties: { actor_id: string; group_id: string } & SubjectProperties;
    }
  | {
      event: "group_member_removed";
      properties: { actor_id: string; group_id: string } & SubjectProperties;
    }
  // Workflows
  | {
      event: "workflow_email_sent";
      properties: { email_type: WorkflowEmailType; subject_id: string };
    }
  | {
      event: "workflow_batch_group_bootstrapped";
      properties: { batch_number: number; member_count: number };
    };

export function track(params: { distinctId: string } & TrackingEvent): void {
  try {
    getPostHogClient()?.capture({
      distinctId: params.distinctId,
      event: params.event,
      properties: "properties" in params ? params.properties : undefined,
    });
  } catch (err) {
    console.error(`[analytics] Failed to capture ${params.event}:`, err);
  }
}

export function buildSubjectMetadata(
  user: SubjectUser,
  lastPaymentDate?: string | null,
): SubjectProperties {
  const meta: SubjectProperties = {
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
