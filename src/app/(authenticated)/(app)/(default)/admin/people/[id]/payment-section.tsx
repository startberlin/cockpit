import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActivePaymentTerm } from "@/db/membership-payments";
import { getUserDetails } from "@/db/people";
import { getGcPaymentHistoryForMember } from "@/lib/gocardless/payments";
import { PaymentTableClient } from "./payment-table-client";

const COLLECTED_STATUSES = new Set(["paid", "confirmed", "paid_out"]);

function formatAmount(amountCents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildSummaryText(
  totalCents: number,
  earliestDate: Date | null,
): string {
  const amount = formatAmount(totalCents);
  if (!earliestDate) return `${amount} collected.`;

  const now = new Date();
  const monthsDiff =
    (now.getFullYear() - earliestDate.getFullYear()) * 12 +
    (now.getMonth() - earliestDate.getMonth());

  if (monthsDiff < 12) {
    return `${amount} collected.`;
  }

  const years = Math.floor(monthsDiff / 12);
  const yearLabel = years === 1 ? "1 year" : `${years} years`;
  return `${amount} collected over ${yearLabel}.`;
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

  const collectedPayments = paymentHistory.filter((p) =>
    COLLECTED_STATUSES.has(p.status),
  );
  const totalCollectedCents = collectedPayments.reduce(
    (sum, p) => sum + p.amount,
    0,
  );

  const earliestCollectedDate =
    collectedPayments.length > 0
      ? collectedPayments.reduce<Date | null>((earliest, p) => {
          if (!p.chargeDate) return earliest;
          const d = new Date(`${p.chargeDate}T00:00:00`);
          return !earliest || d < earliest ? d : earliest;
        }, null)
      : null;

  let nextDueDate: string | null = null;
  if (paymentTerm) {
    if (paymentTerm.status === "proposed") {
      // For a proposed payment the collection date is the activation date itself
      nextDueDate = formatDate(paymentTerm.activationDate);
    } else {
      const d = new Date(`${paymentTerm.activationDate}T00:00:00`);
      d.setFullYear(d.getFullYear() + 1);
      nextDueDate = formatDate(d.toISOString().slice(0, 10));
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Payments</CardTitle>
        <CardDescription>Membership payments of this member.</CardDescription>
        {nextDueDate && (
          <CardAction>
            <Badge variant="outline">Next collection at {nextDueDate}</Badge>
          </CardAction>
        )}
      </CardHeader>
      {recentPayments.length > 0 ? (
        <CardContent className="p-0">
          <PaymentTableClient payments={recentPayments} />
        </CardContent>
      ) : (
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {mandateStatus === "not_set_up"
              ? "No direct debit set up."
              : "No payment history."}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
