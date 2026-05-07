import { AuthorityEditor } from "@/components/authority-editor";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UserDetail } from "@/db/people";
import { DEPARTMENTS } from "@/lib/enums";

interface AuthorityCardProps {
  user: UserDetail;
  canManageAuthority: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  president: "President",
  vice_president: "Vice President",
  head_of_finance: "Head of Finance",
};

const PERMISSION_LABELS: Record<string, string> = {
  admin: "Admin",
};

function formatScope(department: string | null) {
  return department
    ? DEPARTMENTS[department as keyof typeof DEPARTMENTS]
    : null;
}

function formatRoleLabel(position: string, department: string | null) {
  if (position === "department_head") {
    const departmentName = formatScope(department);

    return departmentName ? `Head of ${departmentName}` : "Department head";
  }

  return ROLE_LABELS[position] ?? position;
}

export function AuthorityCard({
  user,
  canManageAuthority,
}: AuthorityCardProps) {
  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Roles and permissions</CardTitle>
        <CardDescription>
          See which START Berlin positions this member holds and what access
          they have in START Cockpit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              START positions
            </p>
            <div className="flex flex-wrap gap-2">
              {user.organizationPositions.length > 0 ? (
                user.organizationPositions.map((assignment) => (
                  <Badge key={assignment.id} variant="secondary">
                    {formatRoleLabel(
                      assignment.position,
                      assignment.department,
                    )}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No START positions assigned.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              App permissions
            </p>
            <div className="flex flex-wrap gap-2">
              {user.accessGrants.length > 0 ? (
                user.accessGrants.map((assignment) => (
                  <Badge key={assignment.id} variant="secondary">
                    {PERMISSION_LABELS[assignment.grant] ?? assignment.grant}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No extra app permissions assigned.
                </p>
              )}
            </div>
          </div>
        </div>

        {canManageAuthority && (
          <AuthorityEditor
            userId={user.id}
            positions={user.organizationPositions}
            grants={user.accessGrants}
          />
        )}
      </CardContent>
    </Card>
  );
}
