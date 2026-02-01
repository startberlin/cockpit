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

export function ProfileCard({ user }: ProfileCardProps) {
  const statusInfo = USER_STATUS_INFO[user.status];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Member details and contact information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Status
              </p>
              <Badge variant="outline" className="capitalize">
                {statusInfo.label}
              </Badge>
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

          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Member Since
            </p>
            <p className="text-sm font-medium">
              {new Date(user.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
