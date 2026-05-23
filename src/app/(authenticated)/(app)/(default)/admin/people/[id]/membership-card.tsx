import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getActiveLegalMembership, getMemberSinceDate } from "@/db/membership";
import { getDepartmentHeadForDepartment, getUserDetails } from "@/db/people";
import type { LegalMembershipState } from "@/db/schema/auth";
import { DEPARTMENT_NAMES } from "@/lib/departments";
import { USER_STATUS_INFO } from "@/lib/user-status";
import { MembershipCardMenu } from "./membership-card-menu";

const LEGAL_MEMBERSHIP_STATE_INFO: Record<
  LegalMembershipState,
  { label: string; tooltip: string; active: boolean }
> = {
  not_member: {
    label: "Not a member",
    tooltip: "This person has not yet completed the legal membership process.",
    active: false,
  },
  active_member: {
    label: "Legal member",
    tooltip: "This person is a legally registered member of START Berlin e.V.",
    active: true,
  },
  former_member: {
    label: "Former legal member",
    tooltip:
      "This person was previously a legal member but has left the association.",
    active: false,
  },
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
      {children}
    </p>
  );
}

function unit(n: number, label: string) {
  return `${n} ${label}${n !== 1 ? "s" : ""}`;
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
    return parts.join(" and ");
  }

  if (months > 0) return unit(months, "month");

  const weeks = Math.floor(days / 7);
  if (weeks > 0) return unit(weeks, "week");
  return unit(Math.max(days, 1), "day");
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface MembershipCardProps {
  userId: string;
  canPropose: boolean;
  canRemove: boolean;
}

export async function MembershipCard({
  userId,
  canPropose,
  canRemove,
}: MembershipCardProps) {
  const user = await getUserDetails(userId);

  if (!user) return null;

  const [memberSince, , departmentHead] = await Promise.all([
    getMemberSinceDate(userId),
    getActiveLegalMembership(userId),
    user.department
      ? getDepartmentHeadForDepartment(user.department)
      : Promise.resolve(null),
  ]);

  const statusInfo = USER_STATUS_INFO[user.status];
  const legalStateInfo = LEGAL_MEMBERSHIP_STATE_INFO[user.legalMembershipState];
  const duration = memberSince ? formatDuration(memberSince, new Date()) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Membership</CardTitle>
        <MembershipCardMenu
          userId={userId}
          canPropose={canPropose}
          canRemove={canRemove}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel>Status</FieldLabel>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="capitalize">
                  {statusInfo.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top">
                {statusInfo.description}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Batch</FieldLabel>
            <p className="text-sm font-medium">
              {user.batchNumber != null ? `#${user.batchNumber}` : "—"}
            </p>
          </div>
        </div>

        {user.department && (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Department</FieldLabel>
                <Badge variant="outline">
                  {DEPARTMENT_NAMES[user.department]}
                </Badge>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Department lead</FieldLabel>
                {departmentHead ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 text-xs">
                      <AvatarImage
                        src={departmentHead.image ?? undefined}
                        alt={`${departmentHead.firstName} ${departmentHead.lastName}`}
                      />
                      <AvatarFallback>
                        {departmentHead.firstName[0]}
                        {departmentHead.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">
                      {departmentHead.firstName} {departmentHead.lastName}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm font-medium">—</p>
                )}
              </div>
            </div>
          </>
        )}

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel>Member since</FieldLabel>
            <p className="text-sm font-medium">
              {memberSince ? formatDate(memberSince) : "—"}
            </p>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Member for</FieldLabel>
            <p className="text-sm font-medium">{duration ?? "—"}</p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel>Legal membership</FieldLabel>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={
                    legalStateInfo.active ? undefined : "text-muted-foreground"
                  }
                >
                  {legalStateInfo.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top">
                {legalStateInfo.tooltip}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Profile onboarding</FieldLabel>
            {user.profileOnboardingComplete ? (
              <Badge variant="outline">Complete</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Not yet complete
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
