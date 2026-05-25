"use client";

import { Check, Copy, Layers } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PublicGroup } from "@/db/groups";

interface SystemGroupEntry {
  slug: string;
  name: string;
  email: string;
  isMember: boolean;
}

interface UnifiedGroup {
  key: string;
  name: string;
  email: string | null;
  href: string;
  isMember: boolean;
}

interface GroupsClientProps {
  systemGroups: SystemGroupEntry[];
  manualGroups: PublicGroup[];
}

function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 text-muted-foreground"
      title="Copy email address"
      onClick={(e) => {
        e.preventDefault();
        navigator.clipboard.writeText(email);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

function GroupCard({ group }: { group: UnifiedGroup }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent transition-colors">
      <Link
        href={group.href}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <div className="rounded-md bg-muted p-2 shrink-0">
          <Layers className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{group.name}</div>
          {group.email && (
            <div className="text-xs text-muted-foreground truncate">
              {group.email}
            </div>
          )}
        </div>
      </Link>
      {group.email && <CopyEmailButton email={group.email} />}
    </div>
  );
}

function GroupGrid({ groups }: { groups: UnifiedGroup[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {groups.map((g) => (
        <GroupCard key={g.key} group={g} />
      ))}
    </div>
  );
}

export default function GroupsClient({
  systemGroups,
  manualGroups,
}: GroupsClientProps) {
  const allGroups: UnifiedGroup[] = [
    ...systemGroups.map((sg) => ({
      key: sg.slug,
      name: sg.name,
      email: sg.email,
      href: `/groups/${sg.slug}`,
      isMember: sg.isMember,
    })),
    ...manualGroups.map((mg) => ({
      key: mg.id,
      name: mg.name,
      email: mg.googleGroupEmail,
      href: `/groups/${mg.id}`,
      isMember: mg.isMember,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const myGroups = allGroups.filter((g) => g.isMember);
  const otherGroups = allGroups.filter((g) => !g.isMember);

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
        <p className="text-muted-foreground text-sm mt-1">
          The groups that connect you to the START Berlin community.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">My groups</h2>
        {myGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            You&apos;re not a member of any groups yet.
          </p>
        ) : (
          <GroupGrid groups={myGroups} />
        )}
      </div>

      {otherGroups.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Other groups</h2>
          <GroupGrid groups={otherGroups} />
        </div>
      )}
    </div>
  );
}
