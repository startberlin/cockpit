import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getUserDetails } from "@/db/people";
import type { LegalMembershipState } from "@/db/schema/auth";
import { DEPARTMENT_NAMES } from "@/lib/departments";
import { USER_STATUS_INFO } from "@/lib/user-status";
import { MemberHeaderMenu } from "./member-header-menu";

const ACTIVE_LEGAL_STATES: LegalMembershipState[] = ["active_member"];

interface MemberHeaderProps {
  userId: string;
  canImpersonate: boolean;
}

export async function MemberHeader({
  userId,
  canImpersonate,
}: MemberHeaderProps) {
  const user = await getUserDetails(userId);

  if (!user) {
    return null;
  }

  const initials =
    `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  const statusInfo = USER_STATUS_INFO[user.status];
  const isLegalMember = ACTIVE_LEGAL_STATES.includes(user.legalMembershipState);

  return (
    <div className="relative flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4">
      <Avatar className="h-16 w-16 text-xl sm:h-14 sm:w-14 sm:text-lg">
        <AvatarImage
          src={user.image ?? undefined}
          alt={`${user.firstName} ${user.lastName}`}
        />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex flex-col items-center gap-2 sm:items-start">
        <h1 className="text-2xl font-semibold tracking-tight">
          {user.firstName} {user.lastName}
        </h1>
        <p className="text-muted-foreground text-sm">{user.email}</p>

        <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
          {user.batchNumber != null && (
            <Badge variant="outline" className="text-xs">
              Batch #{user.batchNumber}
            </Badge>
          )}
          {user.department && (
            <Badge variant="outline" className="text-xs">
              {DEPARTMENT_NAMES[user.department]}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {statusInfo.label}
          </Badge>
          {isLegalMember && (
            <Badge variant="outline" className="text-xs">
              Legal member
            </Badge>
          )}
        </div>
      </div>

      {canImpersonate && (
        <div className="absolute right-0 top-0">
          <MemberHeaderMenu userId={userId} userEmail={user.email ?? ""} />
        </div>
      )}
    </div>
  );
}
