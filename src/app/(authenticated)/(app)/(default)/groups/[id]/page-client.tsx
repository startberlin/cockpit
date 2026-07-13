"use client";

import { ArrowLeft, Check, Copy, Crown } from "lucide-react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { parseAsInteger, useQueryState } from "nuqs";
import { use, useState } from "react";
import { BreadcrumbCrumb } from "@/components/breadcrumb-bridge";
import { useCan } from "@/components/can";
import { GroupExportMenu } from "@/components/group-export-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GroupDetail, GroupMember } from "@/db/groups";

type SystemGroupMember = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

type GroupDetailClientProps =
  | {
      kind: "system";
      slug: string;
      name: string;
      googleGroupEmail: string;
      members: SystemGroupMember[];
    }
  | {
      kind: "manual";
      groupDetailPromise: Promise<GroupDetail | null>;
    };

export function GroupDetailBreadcrumb({
  groupDetailPromise,
}: {
  groupDetailPromise: Promise<GroupDetail | null>;
}) {
  const group = use(groupDetailPromise);
  if (!group) return null;
  return (
    <BreadcrumbCrumb
      crumbs={[{ label: "Groups", href: "/groups" }, { label: group.name }]}
    />
  );
}

function SystemGroupView({
  slug,
  name,
  googleGroupEmail,
  members,
}: {
  slug: string;
  name: string;
  googleGroupEmail: string;
  members: SystemGroupMember[];
}) {
  const router = useRouter();
  const can = useCan();
  const [emailCopied, setEmailCopied] = useState(false);
  const canExport = can("group.export", {
    id: slug,
    isMember: false,
  });
  const canExportPhone = can("group.export_phone", {
    id: slug,
    isMember: false,
  });

  return (
    <div className="w-full space-y-6">
      <BreadcrumbCrumb
        crumbs={[{ label: "Groups", href: "/groups" }, { label: name }]}
      />
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 text-muted-foreground"
          onClick={() => router.back()}
        >
          <ArrowLeft />
          Back
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-muted-foreground text-sm">
            {googleGroupEmail}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            onClick={() => {
              navigator.clipboard.writeText(googleGroupEmail);
              setEmailCopied(true);
              setTimeout(() => setEmailCopied(false), 2000);
            }}
          >
            {emailCopied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 pb-3">
          <h2 className="text-sm font-semibold">Members</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {members.length} member{members.length === 1 ? "" : "s"}
            </span>
            {members.length > 0 && canExport ? (
              <GroupExportMenu groupId={slug} canExportPhone={canExportPhone} />
            ) : null}
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell className="py-10 text-center text-muted-foreground text-sm">
                    No members match this group&apos;s criteria right now.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 text-xs">
                          <AvatarFallback>
                            {member.firstName?.[0]}
                            {member.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">
                            {member.firstName} {member.lastName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {member.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function ManualGroupView({
  groupDetailPromise,
}: {
  groupDetailPromise: Promise<GroupDetail | null>;
}) {
  const can = useCan();
  const router = useRouter();
  const group = use(groupDetailPromise);
  const [emailCopied, setEmailCopied] = useState(false);
  const [membersPage, setMembersPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  );

  if (!group) notFound();

  const canViewMemberProfile = (member: GroupMember) =>
    can("user.view_details", member);
  const canExport = can("group.export", {
    id: group.id,
    isMember: group.isMember,
    isManager: group.isGroupManager,
  });
  const canExportPhone = can("group.export_phone", {
    id: group.id,
    isMember: group.isMember,
    isManager: group.isGroupManager,
  });

  return (
    <div className="w-full space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 text-muted-foreground"
          onClick={() => router.back()}
        >
          <ArrowLeft />
          Back
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
        {group.googleGroupEmail && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-muted-foreground text-sm">
              {group.googleGroupEmail}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={() => {
                navigator.clipboard.writeText(group.googleGroupEmail ?? "");
                setEmailCopied(true);
                setTimeout(() => setEmailCopied(false), 2000);
              }}
            >
              {emailCopied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 pb-3">
          <h2 className="text-sm font-semibold">Members</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {group.totalMembers} member
              {group.totalMembers === 1 ? "" : "s"}
            </span>
            {group.totalMembers > 0 && canExport ? (
              <GroupExportMenu
                groupId={group.id}
                canExportPhone={canExportPhone}
              />
            ) : null}
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.totalMembers === 0 ? (
                <TableRow>
                  <TableCell className="py-10 text-center text-muted-foreground text-sm">
                    No members yet.
                  </TableCell>
                </TableRow>
              ) : (
                group.members.map((member) => {
                  const canViewProfile = canViewMemberProfile(member);
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8 text-xs">
                            <AvatarFallback>
                              {member.firstName[0]}
                              {member.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm flex items-center gap-1.5">
                              {canViewProfile ? (
                                <Link
                                  href={`/admin/people/${member.id}`}
                                  className="hover:underline"
                                >
                                  {member.firstName} {member.lastName}
                                </Link>
                              ) : (
                                <span>
                                  {member.firstName} {member.lastName}
                                </span>
                              )}
                              {member.role === "manager" && (
                                <Crown className="h-3 w-3 text-amber-500 shrink-0" />
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {group.memberPageCount > 1 && (
          <div className="flex items-center justify-between pt-3">
            <span className="text-sm text-muted-foreground">
              {group.totalMembers} member{group.totalMembers === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMembersPage(membersPage - 1)}
                disabled={membersPage <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {membersPage} / {group.memberPageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMembersPage(membersPage + 1)}
                disabled={membersPage >= group.memberPageCount}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GroupDetailClient(props: GroupDetailClientProps) {
  if (props.kind === "system") {
    return (
      <SystemGroupView
        slug={props.slug}
        name={props.name}
        googleGroupEmail={props.googleGroupEmail}
        members={props.members}
      />
    );
  }
  return <ManualGroupView groupDetailPromise={props.groupDetailPromise} />;
}
