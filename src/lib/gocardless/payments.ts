import { gocardless } from "./client";

export interface GcPaymentRecord {
  id: string;
  status: string;
  amount: number;
  currency: string;
  chargeDate: string | null;
  description: string | null;
  createdAt: string;
}

export async function createOneTimePayment({
  mandateId,
  amount,
  idempotencyKey,
}: {
  mandateId: string;
  amount: number;
  idempotencyKey: string;
}): Promise<{ id: string }> {
  const payment = await gocardless.payments.create(
    {
      amount: String(amount),
      currency: "EUR",
      links: { mandate: mandateId },
    },
    idempotencyKey,
  );

  if (!payment.id) throw new Error("GoCardless did not return a payment id");
  return { id: payment.id };
}

export async function getGcPaymentHistoryForMember(
  gcCustomerId: string,
): Promise<GcPaymentRecord[]> {
  const response = await gocardless.payments.list({ customer: gcCustomerId });

  return response.payments.map((p) => ({
    id: p.id ?? "",
    status: p.status ?? "",
    amount: Number(p.amount ?? 0),
    currency: p.currency ?? "",
    chargeDate: p.charge_date ?? null,
    description: p.description ?? null,
    createdAt: p.created_at ?? "",
  }));
}
