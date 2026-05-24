"use client";

import { Layers } from "lucide-react";
import Link from "next/link";
import type { SystemGroup } from "@/lib/groups/system-groups";

interface ManualGroup {
  id: string;
  name: string;
  slug: string;
  googleGroupEmail: string | null;
}

interface MyGroupsClientProps {
  systemGroups: SystemGroup[];
  manualGroups: ManualGroup[];
}

function GroupRow({
  href,
  name,
  email,
}: {
  href: string;
  name: string;
  email: string | null;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent transition-colors"
    >
      <div className="rounded-md bg-muted p-2 shrink-0">
        <Layers className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="font-medium text-sm truncate">{name}</div>
        {email && (
          <div className="text-xs text-muted-foreground truncate">{email}</div>
        )}
      </div>
    </Link>
  );
}

export default function MyGroupsClient({
  systemGroups,
  manualGroups,
}: MyGroupsClientProps) {
  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Groups</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Groups you belong to, automatically and manually.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">System groups</h2>
        <p className="text-xs text-muted-foreground -mt-1">
          Auto-managed based on your membership status, department, and batch.
        </p>
        {systemGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            You don&apos;t belong to any system groups right now.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {systemGroups.map((g) => (
              <GroupRow
                key={g.slug}
                href={`/groups/${g.slug}`}
                name={g.name}
                email={g.googleGroupEmail}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">My groups</h2>
        <p className="text-xs text-muted-foreground -mt-1">
          Groups you&apos;ve been manually added to.
        </p>
        {manualGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            You haven&apos;t been added to any manual groups yet.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {manualGroups.map((g) => (
              <GroupRow
                key={g.id}
                href={`/groups/${g.id}`}
                name={g.name}
                email={g.googleGroupEmail}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
