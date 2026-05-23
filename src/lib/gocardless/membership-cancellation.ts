import { gocardless } from "./client";

const TERMINAL_MANDATE_STATUSES = new Set([
  "cancelled",
  "failed",
  "expired",
  "blocked",
]);

export async function cancelMembershipMandate(
  mandateId: string,
): Promise<void> {
  const mandate = await gocardless.mandates.find(mandateId);

  if (mandate.status && TERMINAL_MANDATE_STATUSES.has(mandate.status)) {
    return;
  }

  await gocardless.mandates.cancel(mandateId, {});
}
