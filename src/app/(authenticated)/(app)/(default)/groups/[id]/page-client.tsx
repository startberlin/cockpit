"use client";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Download,
  Loader2,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { parseAsInteger, useQueryState } from "nuqs";
import { use, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Can, useCan } from "@/components/can";
import GroupCriteriaManager from "@/components/group-criteria-manager";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { GroupDetail, GroupMember } from "@/db/groups";
import type { PublicUser } from "@/db/people";
import { authClient } from "@/lib/auth-client";
import {
  addUserToGroupAction,
  pinGroupMemberAction,
  removeUserFromGroupAction,
  searchUsersNotInGroupAction,
} from "./actions";

interface GroupDetailClientProps {
  groupDetailPromise: Promise<GroupDetail | null>;
}

export default function GroupDetailClient({
  groupDetailPromise,
}: GroupDetailClientProps) {
  const can = useCan();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? null;
  const groupDetail = use(groupDetailPromise);

  if (!groupDetail) {
    notFound();
  }

  const [group, setGroup] = useState(groupDetail);
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [membersPage, setMembersPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  );

  // Sync local state when server data refreshes (e.g. after router.refresh())
  useEffect(() => {
    setGroup(groupDetail);
  }, [groupDetail]);

  const loadAvailableUsers = useCallback(
    async (query?: string) => {
      setIsSearching(true);
      try {
        const result = await searchUsersNotInGroupAction(group.id, query);
        setSearchResults(result);
      } catch (_error) {
        toast.error(
          "Could not load members. Please try again. If this keeps happening, email operations@start-berlin.com.",
        );
      } finally {
        setIsSearching(false);
      }
    },
    [group.id],
  );

  useEffect(() => {
    if (isAddMemberDialogOpen) {
      loadAvailableUsers();
    }
  }, [isAddMemberDialogOpen, loadAvailableUsers]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    await loadAvailableUsers(query || undefined);
  };

  const handleAddMember = async (user: PublicUser) => {
    try {
      await addUserToGroupAction(user.id, group.id);
      setIsAddMemberDialogOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      toast.success(`Added ${user.firstName} ${user.lastName} to the group`);
      router.refresh();
    } catch (_error) {
      toast.error(
        "Could not add member to group. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    }
  };

  const handleRemoveMember = async (member: GroupMember) => {
    try {
      await removeUserFromGroupAction(member.id, group.id);
      toast.success(
        `Removed ${member.firstName} ${member.lastName} from the group`,
      );
      router.refresh();
    } catch (_error) {
      toast.error(
        "Could not remove member from group. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    }
  };

  const handlePinMember = async (member: GroupMember) => {
    try {
      await pinGroupMemberAction(member.id, group.id);
      toast.success(
        `${member.firstName} ${member.lastName} will stay in this group even if they no longer match any matching rules.`,
      );
      router.refresh();
    } catch (_error) {
      toast.error(
        "Could not update member. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    }
  };

  useEffect(() => {
    if (!group.googleSyncPending) return;
    const pollId = setInterval(() => router.refresh(), 3000);
    const timeoutId = setTimeout(() => clearInterval(pollId), 120_000);
    return () => {
      clearInterval(pollId);
      clearTimeout(timeoutId);
    };
  }, [group.googleSyncPending, router]);

  const handleCriteriaChange = () => {
    router.refresh();
  };

  const groupScope = { isMember: group.isMember };
  const canManageMembers = can("group.members.manage", groupScope);
  const canExport = can("group.export", groupScope);
  const canViewMemberProfile = (member: GroupMember) =>
    can("user.view_details", member);

  return (
    <div className="w-full space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 text-muted-foreground"
          asChild
        >
          <Link href="/groups">
            <ArrowLeft />
            Back to groups
          </Link>
        </Button>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {group.name}
          </h1>
          {group.googleSyncPending && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
              <Loader2 className="h-4 w-4 animate-spin" />
              Syncing with Google…
            </span>
          )}
        </div>
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

      <Can permission="group.members.manage" context={groupScope}>
        <GroupCriteriaManager
          groupId={group.id}
          criteria={group.criteria}
          googleSyncPending={group.googleSyncPending}
          onCriteriaChange={handleCriteriaChange}
        />
      </Can>

      <div>
        <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h2 className="text-sm font-semibold">Members</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {group.totalMembers} member
              {group.totalMembers === 1 ? "" : "s"}
            </span>
            {group.totalMembers > 0 && canExport && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Export
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <a href={`/api/groups/${group.id}/export`} download>
                      CSV for Luma
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {canManageMembers && (
              <Dialog
                open={isAddMemberDialogOpen}
                onOpenChange={setIsAddMemberDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add member to {group.name}</DialogTitle>
                    <DialogDescription>
                      Search for a person to add to this group.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {isSearching && (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      </div>
                    )}

                    {searchResults.length > 0 && (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {searchResults.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {user.firstName[0]}
                                  {user.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">
                                  {user.firstName} {user.lastName}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {user.email}
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddMember(user)}
                            >
                              <UserPlus className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {searchQuery &&
                      !isSearching &&
                      searchResults.length === 0 && (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          No members found matching "{searchQuery}"
                        </div>
                      )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Added by</TableHead>
                {canManageMembers && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.totalMembers === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManageMembers ? 3 : 2}
                    className="py-10 text-center text-muted-foreground text-sm"
                  >
                    No members yet.
                  </TableCell>
                </TableRow>
              ) : (
                group.members.map((member) => {
                  const canViewProfile = canViewMemberProfile(member);
                  const isSelf = member.id === currentUserId;

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
                            <div className="font-medium text-sm">
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
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          {member.source === "criteria" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="text-xs cursor-default"
                                >
                                  Matching rule
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                Added automatically because they match a rule
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="text-xs cursor-default"
                                >
                                  Manual
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                Added manually and won't be auto-removed by
                                matching rules
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TooltipProvider>
                      </TableCell>
                      {canManageMembers && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {member.source === "criteria" && (
                                <DropdownMenuItem
                                  onClick={() => handlePinMember(member)}
                                >
                                  <Pin className="h-4 w-4 mr-2 shrink-0" />
                                  <div className="flex flex-col">
                                    <span>Keep in group</span>
                                    <span className="text-xs text-muted-foreground font-normal leading-tight">
                                      Won't be removed by matching rules
                                    </span>
                                  </div>
                                </DropdownMenuItem>
                              )}
                              {member.source !== "criteria" && !isSelf && (
                                <DropdownMenuItem
                                  onClick={() => handleRemoveMember(member)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2 shrink-0" />
                                  Remove from group
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
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
              {group.totalMembers} member
              {group.totalMembers === 1 ? "" : "s"}
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
