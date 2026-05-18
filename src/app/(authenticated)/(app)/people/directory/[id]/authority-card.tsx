import { AuthorityEditor } from "@/components/authority-editor";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserAuthorityData } from "@/db/people";
import { DEPARTMENTS } from "@/lib/enums";
import { can } from "@/lib/permissions/server";

interface AuthorityCardProps {
  userId: string;
  canManageAuthority: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  president: "President",
  vice_president: "Vice President",
  head_of_finance: "Head of Finance",
};

const PERMISSION_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  finance_admin: "Finance Admin",
  people_admin: "People Admin",
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

export async function AuthorityCard({
  userId,
  canManageAuthority,
}: AuthorityCardProps) {
  const data = await getUserAuthorityData(userId);

  if (!data) {
    return null;
  }

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
              Positions
            </p>
            <div className="flex flex-wrap gap-2">
              {data.organizationPositions.length > 0 ? (
                data.organizationPositions.map((assignment) => (
                  <Badge key={assignment.id} variant="secondary">
                    {formatRoleLabel(
                      assignment.position,
                      assignment.department,
                    )}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No positions assigned.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              App permissions
            </p>
            <div className="flex flex-wrap gap-2">
              {data.accessGrants.length > 0 ? (
                data.accessGrants.map((assignment) => (
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
            userId={data.id}
            positions={data.organizationPositions}
            grants={data.accessGrants}
            canSetSuperAdmin={await can("users.impersonate")}
          />
        )}
      </CardContent>
    </Card>
  );
}
