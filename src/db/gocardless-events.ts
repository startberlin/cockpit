import { eq } from "drizzle-orm";
import db from "@/db";
import { advancePaymentStatus } from "@/db/membership-payments";
import MembershipPaymentUpcomingEmail from "@/emails/membership/payment/membership-payment-upcoming";
import { sendEmail } from "@/lib/email";
import { reconcileMembershipPaymentByBillingRequestId } from "@/lib/gocardless/membership-reconciliation";
import type { GoCardlessEvent } from "@/lib/gocardless/webhook";
import {
  getGoCardlessEventUserHints,
  getGoCardlessPaymentId,
  isMandateInvalidatedEvent,
  isMembershipMandateReadyEvent,
  isPaymentLifecycleEvent,
} from "@/lib/gocardless/webhook";
import { events, inngest } from "@/lib/inngest";
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
    // Look up user before clearing the mandate ID — field will be null after the UPDATE.
    const mandateUser = await db.query.user.findFirst({
      where: (u, { eq: eqFn }) =>
        eqFn(u.gocardlessMandateId, event.links.mandate as string),
      columns: {
        id: true,
        email: true,
        firstName: true,
        gocardlessCustomerId: true,
      },
    });

    // If the event includes a customer ID, verify it matches what we have on
    // file before clearing. This prevents a duplicate-customer cleanup from
    // wiping a legitimate mandate: if two GC customers were created for the
    // same user (race condition) and admin cancels the orphaned one, we must
    // not touch the user whose stored customer belongs to a different account.
    if (
      mandateUser &&
      event.links.customer &&
      mandateUser.gocardlessCustomerId &&
      mandateUser.gocardlessCustomerId !== event.links.customer
    ) {
      return { status: "ignored" as const };
    }

    await db
      .update(user)
      .set({
        gocardlessMandateId: null,
        gocardlessSetupSessionId: null,
        gocardlessBillingRequestId: null,
      })
      .where(eq(user.gocardlessMandateId, event.links.mandate));

    const reSetupActions = ["cancelled", "expired", "failed"];
    if (mandateUser && reSetupActions.includes(event.action)) {
      // Defer the initial email and the 3-day reminder cadence to the
      // mandate-fix-reminder workflow — that keeps email state out of the
      // webhook handler and gives us cancel-on semantics for free.
      await inngest.send({
        name: events.mandateInvalidated.name,
        data: { userId: mandateUser.id },
      });
    }

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
    columns: { id: true, status: true, userId: true, amount: true },
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

  if (event.action === "submitted" && row.userId) {
    try {
      const paymentUser = await db.query.user.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, row.userId as string),
        columns: { email: true, firstName: true },
      });
      if (paymentUser?.email) {
        await sendEmail({
          from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
          to: paymentUser.email,
          subject: "Your START Berlin membership payment is coming up",
          react: MembershipPaymentUpcomingEmail({
            firstName: paymentUser.firstName ?? "",
            amountEur: (row.amount ?? 4000) / 100,
          }),
        });
      }
    } catch (err) {
      console.error("[payment-upcoming email] failed to send:", err);
    }
  }

  return { status: event.action };
}
