import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserAuthorityData } from "@/db/people";
import { DEPARTMENTS } from "@/lib/enums";

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
                  <Badge
                    key={`${assignment.position}-${assignment.scope}`}
                    variant="secondary"
                  >
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
                  <Badge key={assignment.grant} variant="secondary">
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
          <div className="flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/settings">Manage in Settings →</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
