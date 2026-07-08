import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getUserAuthorityData } from "@/db/people";
import type { AccessGrant, OrganizationPosition } from "@/db/schema/authority";
import { DEPARTMENT_NAMES } from "@/lib/departments";

const POSITION_LABELS: Record<OrganizationPosition, string> = {
  president: "President",
  vice_president: "Vice President",
  head_of_finance: "Head of Finance",
  department_head: "Head of Department",
  department_co_head: "Co-Head of Department",
};

const GRANT_LABELS: Record<AccessGrant, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  finance_admin: "Finance Admin",
  people_admin: "People Admin",
  members_group_exporter: "Members Group Exporter",
};

interface PermissionsSectionProps {
  userId: string;
}

export async function PermissionsSection({ userId }: PermissionsSectionProps) {
  const authorityData = await getUserAuthorityData(userId);

  if (!authorityData) return null;

  const { organizationPositions, accessGrants } = authorityData;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Roles & permissions</CardTitle>
          <CardDescription className="mt-1.5">
            Positions at START Berlin and what access this member has in the
            app.
          </CardDescription>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href={`/admin/people/${userId}/permissions`}>
            Edit permissions
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            Positions
          </p>
          {organizationPositions.length > 0 ? (
            <div className="space-y-2">
              {organizationPositions.map((p, i) => {
                const label =
                  p.position === "department_head" && p.department
                    ? `Head of ${DEPARTMENT_NAMES[p.department]}`
                    : p.position === "department_co_head" && p.department
                      ? `Co-Head of ${DEPARTMENT_NAMES[p.department]}`
                      : POSITION_LABELS[p.position];
                return (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No positions.</p>
          )}
        </div>

        <Separator />

        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            App permissions
          </p>
          {accessGrants.length > 0 ? (
            <div className="space-y-2">
              {accessGrants.map((g, i) => {
                const grantName = GRANT_LABELS[g.grant] ?? g.grant;
                return (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{grantName}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No app permissions.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
