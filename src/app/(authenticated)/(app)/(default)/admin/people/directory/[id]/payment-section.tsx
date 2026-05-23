import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getActivePaymentTerm } from "@/db/membership-payments";
import { getUserDetails } from "@/db/people";
import { getGcPaymentHistoryForMember } from "@/lib/gocardless/payments";

function formatAmount(amountCents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
      {children}
    </p>
  );
}

interface PaymentSectionProps {
  userId: string;
}

export async function PaymentSection({ userId }: PaymentSectionProps) {
  const user = await getUserDetails(userId);
  if (!user) return null;

  const { gocardlessMandateId, gocardlessCustomerId } = user;

  const mandateStatus: "active" | "cancelled" | "not_set_up" =
    gocardlessMandateId !== null
      ? "active"
      : gocardlessCustomerId !== null
        ? "cancelled"
        : "not_set_up";

  const [paymentHistory, paymentTerm] = await Promise.all([
    gocardlessCustomerId
      ? getGcPaymentHistoryForMember(gocardlessCustomerId)
      : Promise.resolve([]),
    getActivePaymentTerm(userId),
  ]);

  const recentPayments = paymentHistory.slice(0, 5);

  const nextDueDate = paymentTerm
    ? formatDate(
        new Date(
          new Date(`${paymentTerm.activationDate}T00:00:00`).setFullYear(
            new Date(`${paymentTerm.activationDate}T00:00:00`).getFullYear() +
              1,
          ),
        )
          .toISOString()
          .slice(0, 10),
      )
    : null;

  const mandateLabel =
    mandateStatus === "active"
      ? "Active"
      : mandateStatus === "cancelled"
        ? "Cancelled"
        : "Not set up";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel>Direct debit</FieldLabel>
            <p className="text-sm font-medium">{mandateLabel}</p>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Next payment due</FieldLabel>
            <p className="text-sm font-medium">{nextDueDate ?? "—"}</p>
          </div>
        </div>

        {recentPayments.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <FieldLabel>Recent payments</FieldLabel>
              <div className="divide-y">
                {recentPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div className="space-y-0.5">
                      <p className="font-medium">
                        {formatDate(payment.chargeDate)}
                      </p>
                      <p className="text-muted-foreground capitalize">
                        {payment.status}
                      </p>
                    </div>
                    <p className="font-medium">
                      {formatAmount(payment.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {recentPayments.length === 0 && mandateStatus !== "not_set_up" && (
          <>
            <Separator />
            <p className="text-sm text-muted-foreground">
              No payment history found.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
