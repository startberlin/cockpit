import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getUserDetails } from "@/db/people";
import { USER_STATUS_INFO } from "@/lib/user-status";

interface MemberHeaderProps {
  userId: string;
}

export async function MemberHeader({ userId }: MemberHeaderProps) {
  const user = await getUserDetails(userId);

  if (!user) {
    return null;
  }

  const initials =
    `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  const statusInfo = USER_STATUS_INFO[user.status];

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-14 w-14 text-lg">
        <AvatarImage
          src={user.image ?? undefined}
          alt={`${user.firstName} ${user.lastName}`}
        />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {user.firstName} {user.lastName}
        </h1>
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-sm">{user.email}</p>
          <Badge variant="outline" className="capitalize">
            {statusInfo.label}
          </Badge>
        </div>
      </div>
    </div>
  );
}
