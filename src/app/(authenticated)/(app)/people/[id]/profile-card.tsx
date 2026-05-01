import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { UserDetail } from "@/db/people";
import { DEPARTMENTS } from "@/lib/enums";
import { USER_STATUS_INFO } from "@/lib/user-status";

interface ProfileCardProps {
  user: UserDetail;
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function hasFutureCoverage(date: Date | null, now = new Date()) {
  return !!date && date >= now;
}

export function ProfileCard({ user }: ProfileCardProps) {
  const statusInfo = USER_STATUS_INFO[user.status];
  const isPaymentPending = user.membershipViewState === "payment_pending";
  const isPaymentProcessing = user.membershipViewState === "payment_processing";
  const isImportedFromWorkspace = !!user.googleWorkspaceId;
  const hasPaidThroughCoverage = hasFutureCoverage(user.paidThroughAt);
  const paidThroughLabel = user.paidThroughAt
    ? formatDate(user.paidThroughAt)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Member details and contact information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Status
              </p>
              <Badge variant="outline" className="capitalize">
                {isPaymentProcessing
                  ? "Payment processing"
                  : isPaymentPending
                    ? "Payment pending"
                    : statusInfo.label}
              </Badge>
              {isImportedFromWorkspace && (
                <Badge variant="secondary">
                  Imported from Google Workspace
                </Badge>
              )}
              {isPaymentProcessing && (
                <p className="text-sm text-muted-foreground">
                  Payment setup was started. GoCardless confirmation is still
                  pending.
                </p>
              )}
              {isPaymentPending && (
                <p className="text-sm text-muted-foreground">
                  {hasPaidThroughCoverage
                    ? `Membership billing setup is pending. This member is covered through ${paidThroughLabel}.`
                    : user.paidThroughAt
                      ? "The previous membership payment no longer covers this member."
                      : "Profile onboarding is complete. Membership payment is still pending."}
                </p>
              )}
            </div>
            <div className="space-y-1.5 text-right">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Batch
              </p>
              <p className="text-sm font-medium">#{user.batchNumber}</p>
            </div>
          </div>

          <Separator />

          {user.department && (
            <>
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Department
                </p>
                <Badge variant="outline">{DEPARTMENTS[user.department]}</Badge>
              </div>
              <Separator />
            </>
          )}

          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Roles
            </p>
            <div className="flex flex-wrap gap-2">
              {user.roles.map((role) => (
                <Badge key={role} variant="secondary" className="capitalize">
                  {role.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {isImportedFromWorkspace && (
            <>
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Google Workspace
                </p>
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-sm text-muted-foreground">
                  Linked Workspace ID: {user.googleWorkspaceId}
                </p>
              </div>
              <Separator />
            </>
          )}

          {user.paidThroughAt && (
            <>
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Membership Covered Through
                </p>
                <p className="text-sm font-medium">
                  {formatDate(user.paidThroughAt)}
                </p>
              </div>
              <Separator />
            </>
          )}

          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Member Since
            </p>
            <p className="text-sm font-medium">{formatDate(user.createdAt)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
