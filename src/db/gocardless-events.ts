import { eq } from "drizzle-orm";
import db from "@/db";
import { advancePaymentStatus } from "@/db/membership-payments";
import { reconcileMembershipPaymentByBillingRequestId } from "@/lib/gocardless/membership-reconciliation";
import type { GoCardlessEvent } from "@/lib/gocardless/webhook";
import {
  getGoCardlessEventUserHints,
  getGoCardlessPaymentId,
  isMandateInvalidatedEvent,
  isMembershipMandateReadyEvent,
  isPaymentLifecycleEvent,
} from "@/lib/gocardless/webhook";
import { user } from "./schema/auth";
import { gocardlessProcessedEvents } from "./schema/gocardless-processed-events";
import { membershipPayments } from "./schema/membership-payments";

export async function recordAndProcessGoCardlessEvent(event: GoCardlessEvent) {
  // Deduplicate replayed events — insert fails silently if already processed.
  const [inserted] = await db
    .insert(gocardlessProcessedEvents)
    .values({ eventId: event.id })
    .onConflictDoNothing()
    .returning({ eventId: gocardlessProcessedEvents.eventId });

  if (!inserted) {
    return { status: "duplicate" as const };
  }

  const hints = getGoCardlessEventUserHints(event);

  if (isMembershipMandateReadyEvent(event) && hints.billingRequestId) {
    return reconcileMembershipPaymentByBillingRequestId(hints.billingRequestId);
  }

  if (isMandateInvalidatedEvent(event) && event.links.mandate) {
    await db
      .update(user)
      .set({ gocardlessMandateId: null })
      .where(eq(user.gocardlessMandateId, event.links.mandate));
    return { status: "mandate_cleared" as const };
  }

  if (isPaymentLifecycleEvent(event)) {
    return handlePaymentEvent(event);
  }

  return { status: "ignored" as const };
}

async function handlePaymentEvent(event: GoCardlessEvent & { action: string }) {
  const gcPaymentId = getGoCardlessPaymentId(event);
  if (!gcPaymentId) {
    return { status: "ignored" as const };
  }

  const row = await db.query.membershipPayments.findFirst({
    where: eq(membershipPayments.gocardlessPaymentId, gcPaymentId),
    columns: { id: true, status: true },
  });

  if (!row) {
    return { status: "ignored" as const };
  }

  type FromTo = {
    from: Parameters<typeof advancePaymentStatus>[1];
    to: Parameters<typeof advancePaymentStatus>[2];
  };

  const statusMap: Record<string, FromTo> = {
    submitted: { from: "pending", to: "submitted" },
    confirmed: { from: "submitted", to: "confirmed" },
    paid_out: { from: "confirmed", to: "paid_out" },
    failed: { from: ["pending", "submitted"], to: "failed" },
    cancelled: { from: "pending", to: "cancelled" },
    charged_back: { from: ["confirmed", "paid_out"], to: "charged_back" },
  };

  const transition = statusMap[event.action];
  if (!transition) {
    return { status: "ignored" as const };
  }

  const advanced = await advancePaymentStatus(
    row.id,
    transition.from,
    transition.to,
  );
  if (!advanced) {
    if (row.status === transition.to) {
      return { status: "already_applied" as const };
    }
    throw new Error(
      `Unexpected payment state: payment ${row.id} is '${row.status}', cannot apply event '${event.action}'`,
    );
  }
  return { status: event.action };
}
