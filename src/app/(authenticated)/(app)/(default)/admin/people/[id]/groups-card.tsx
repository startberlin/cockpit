import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserGroupMembershipsWithDetails } from "@/db/people";
import { can } from "@/lib/permissions/server";
import { GroupsTableClient } from "./groups-table-client";

interface GroupsCardProps {
  userId: string;
}

export async function GroupsCard({ userId }: GroupsCardProps) {
  const canViewGroups =
    (await can("group.members.manage")) ||
    (await can("group.managers.manage")) ||
    (await can("group.export"));
  if (!canViewGroups) return null;

  const groups = await getUserGroupMembershipsWithDetails(userId);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Groups</CardTitle>
        {groups.length > 0 && (
          <CardDescription>
            All groups that this member belongs to.
          </CardDescription>
        )}
      </CardHeader>
      {groups.length > 0 ? (
        <CardContent className="p-0">
          <GroupsTableClient groups={groups} />
        </CardContent>
      ) : (
        <CardContent>
          <p className="text-muted-foreground text-sm">No group memberships.</p>
        </CardContent>
      )}
    </Card>
  );
}
