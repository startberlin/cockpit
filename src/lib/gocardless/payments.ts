import { goCardlessRequest } from "./client";

interface CreatePaymentResponse {
  payments: {
    id: string;
    status: string;
    amount: number;
    currency: string;
  };
}

interface GetPaymentsResponse {
  payments: Array<{
    id: string;
    status: string;
    amount: number;
    currency: string;
    charge_date: string | null;
    description: string | null;
    created_at: string;
  }>;
}

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
  const response = await goCardlessRequest<CreatePaymentResponse>("/payments", {
    method: "POST",
    idempotencyKey,
    body: {
      payments: {
        amount,
        currency: "EUR",
        links: { mandate: mandateId },
      },
    },
  });

  return { id: response.payments.id };
}

export async function getGcPaymentHistoryForMember(
  gcCustomerId: string,
): Promise<GcPaymentRecord[]> {
  const response = await goCardlessRequest<GetPaymentsResponse>(
    `/payments?customer=${encodeURIComponent(gcCustomerId)}`,
  );

  return response.payments.map((p) => ({
    id: p.id,
    status: p.status,
    amount: p.amount,
    currency: p.currency,
    chargeDate: p.charge_date,
    description: p.description,
    createdAt: p.created_at,
  }));
}
