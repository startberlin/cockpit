import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserGroupMemberships } from "@/db/people";

interface GroupsCardProps {
  userId: string;
}

export async function GroupsCard({ userId }: GroupsCardProps) {
  const groups = await getUserGroupMemberships(userId);

  if (groups.length === 0) {
    return null;
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Groups</CardTitle>
        <CardDescription>Groups this member belongs to</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="hover:bg-accent flex items-center rounded-lg border p-3 transition-colors"
            >
              <span className="font-medium">{group.name}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
