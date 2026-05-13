import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Department } from "@/db/schema/auth";
import type { MembershipPaymentCycleStatus } from "@/db/schema/membership-payments";
import { DEPARTMENTS } from "@/lib/enums";

interface MembershipDetailsCardProps {
  memberSince: Date | null;
  batchNumber: number | null;
  department: Department | null;
  departmentHead: {
    firstName: string;
    lastName: string;
    image: string | null;
  } | null;
  paymentTerm: {
    activationDate: string;
    status: MembershipPaymentCycleStatus;
  } | null;
  showBillingInfo: boolean;
}

function MembershipField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground leading-none">
        {label}
      </span>
      <span className="truncate text-sm font-medium">{value ?? "—"}</span>
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function unit(n: number, label: string): string {
  return `${n} ${label}${n !== 1 ? "s" : ""}`;
}

function joinWithAnd(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function formatDuration(from: Date, to: Date): string {
  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  let days = to.getDate() - from.getDate();

  if (days < 0) {
    months--;
    days += new Date(to.getFullYear(), to.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  if (years > 0) {
    const parts = [unit(years, "year")];
    if (months > 0) parts.push(unit(months, "month"));
    if (days > 0) parts.push(unit(days, "day"));
    return joinWithAnd(parts);
  }

  if (months > 0) {
    const parts = [unit(months, "month")];
    if (days > 0) parts.push(unit(days, "day"));
    return joinWithAnd(parts);
  }

  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;

  if (weeks > 0) {
    const parts = [unit(weeks, "week")];
    if (remainingDays > 0) parts.push(unit(remainingDays, "day"));
    return joinWithAnd(parts);
  }

  return unit(Math.max(days, 1), "day");
}

function formatPaymentPeriod(activationDate: string): {
  term: string;
  nextDue: string;
} {
  const start = new Date(`${activationDate}T00:00:00`);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);

  const monthYear = (d: Date) =>
    d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return {
    term: `${monthYear(start)} – ${monthYear(end)}`,
    nextDue: formatDate(end),
  };
}

export function MembershipDetailsCard({
  memberSince,
  batchNumber,
  department,
  departmentHead,
  paymentTerm,
  showBillingInfo,
}: MembershipDetailsCardProps) {
  const payment = paymentTerm
    ? formatPaymentPeriod(paymentTerm.activationDate)
    : null;
  const duration = memberSince ? formatDuration(memberSince, new Date()) : null;

  return (
    <div className="flex flex-col gap-6">
      <span className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">My membership</h2>
      </span>
      <Card className="gap-0">
        <CardContent className="flex flex-col gap-6">
          {/* Tenure */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <MembershipField
              label="Member since"
              value={
                memberSince
                  ? batchNumber != null
                    ? `${formatDate(memberSince)} · Batch #${batchNumber}`
                    : formatDate(memberSince)
                  : null
              }
            />
            <MembershipField label="Member for" value={duration} />
          </div>

          {/* Org info */}
          {department && (
            <>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <MembershipField
                  label="Department"
                  value={DEPARTMENTS[department]}
                />
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground leading-none">
                    Department lead
                  </span>
                  {departmentHead ? (
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        {departmentHead.image && (
                          <AvatarImage src={departmentHead.image} />
                        )}
                        <AvatarFallback>
                          {departmentHead.firstName[0]}
                          {departmentHead.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm font-medium">
                        {departmentHead.firstName} {departmentHead.lastName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm font-medium">—</span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Payment */}
          {showBillingInfo && payment && (
            <>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <MembershipField label="Current period" value={payment.term} />
                <MembershipField
                  label="Next payment due"
                  value={payment.nextDue}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
