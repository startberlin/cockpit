import { z } from "zod";

export const GoCardlessEventSchema = z.object({
  id: z.string(),
  created_at: z.string().optional(),
  action: z.string(),
  resource_type: z.string(),
  links: z.record(z.string(), z.string()).default({}),
  details: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const GoCardlessWebhookSchema = z.object({
  events: z.array(GoCardlessEventSchema),
});

export type GoCardlessEvent = z.infer<typeof GoCardlessEventSchema>;

export function isMembershipActivationEvent(event: GoCardlessEvent) {
  return (
    event.resource_type === "subscriptions" &&
    (event.action === "customer_approval_granted" || event.action === "created")
  );
}

export function isMembershipMandateReadyEvent(event: GoCardlessEvent) {
  return (
    event.resource_type === "billing_requests" &&
    event.action === "fulfilled" &&
    !!getGoCardlessMandateId(event)
  );
}

export function isMembershipFailureEvent(event: GoCardlessEvent) {
  return (
    (event.resource_type === "subscriptions" &&
      (event.action === "customer_approval_denied" ||
        event.action === "cancelled")) ||
    (event.resource_type === "billing_requests" && event.action === "cancelled")
  );
}

export function getGoCardlessEventUserHints(event: GoCardlessEvent) {
  return {
    userId:
      event.metadata?.start_cockpit_user_id ??
      event.details?.start_cockpit_user_id?.toString(),
    userEmail:
      event.metadata?.start_cockpit_user_email ??
      event.details?.start_cockpit_user_email?.toString(),
    billingRequestId: event.links.billing_request,
    customerId: event.links.customer,
    subscriptionId: event.links.subscription,
    mandateId: getGoCardlessMandateId(event),
  };
}

function getGoCardlessMandateId(event: GoCardlessEvent) {
  return event.links.mandate ?? event.links.mandate_request_mandate;
}
