import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getUserDetails } from "@/db/people";
import { DEPARTMENTS } from "@/lib/enums";
import { USER_STATUS_INFO } from "@/lib/user-status";

interface ProfileCardProps {
  userId: string;
}

export async function ProfileCard({ userId }: ProfileCardProps) {
  const user = await getUserDetails(userId);

  if (!user) {
    return null;
  }

  const statusInfo = USER_STATUS_INFO[user.status];
  const isPaymentPending = user.membershipState.paymentSetupAllowed;

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
                {isPaymentPending ? "Payment pending" : statusInfo.label}
              </Badge>
              {isPaymentPending && (
                <p className="text-sm text-muted-foreground">
                  Profile onboarding is complete. Membership payment is still
                  pending.
                </p>
              )}
            </div>
            <div className="space-y-1.5 text-right">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Batch
              </p>
              <p className="text-sm font-medium">
                {user.batchNumber != null ? `#${user.batchNumber}` : "—"}
              </p>
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
              Member Since
            </p>
            <p className="text-sm font-medium">{formatDate(user.createdAt)}</p>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Legal Membership
            </p>
            <Badge
              variant="outline"
              className={
                user.legalMembershipState === "active_member"
                  ? "border-green-600 text-green-700"
                  : "text-muted-foreground"
              }
            >
              {LEGAL_MEMBERSHIP_STATE_LABELS[user.legalMembershipState]}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const LEGAL_MEMBERSHIP_STATE_LABELS: Record<string, string> = {
  not_member: "Not a legal member",
  active_member: "Active legal member",
  former_member: "Former legal member",
};

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
