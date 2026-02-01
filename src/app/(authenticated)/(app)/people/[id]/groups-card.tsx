import { Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UserDetail } from "@/db/people";

interface GroupsCardProps {
  groups: UserDetail["groups"];
}

export function GroupsCard({ groups }: GroupsCardProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Groups
          </div>
        </CardTitle>
        <CardDescription>Groups this member belongs to</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="hover:bg-accent flex items-center justify-between rounded-lg border p-3 transition-colors"
            >
              <span className="font-medium">{group.name}</span>
              <Badge variant="outline" className="capitalize">
                {group.role.replace(/_/g, " ")}
              </Badge>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
