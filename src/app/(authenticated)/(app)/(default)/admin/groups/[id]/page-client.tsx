"use client";

import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { use, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/can";
import { GroupExportMenu } from "@/components/group-export-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GroupDetail, GroupMember } from "@/db/groups";
import type { PublicUser } from "@/db/people";
import type { LegalMembershipState, UserStatus } from "@/db/schema/auth";
import { DEPARTMENT_IDS, DEPARTMENT_NAMES } from "@/lib/departments";
import { USER_STATUS_INFO } from "@/lib/user-status";
import {
  addUsersToGroupAction,
  demoteFromManagerAction,
  promoteToManagerAction,
  removeUserFromGroupAction,
} from "../../../groups/[id]/actions";

type SystemGroupMember = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

type AdminGroupDetailClientProps =
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
      availableUsers?: PublicUser[];
    };

function SystemGroupView({
  name,
  googleGroupEmail,
  members,
  slug,
}: {
  name: string;
  googleGroupEmail: string;
  members: SystemGroupMember[];
  slug: string;
}) {
  const router = useRouter();
  const can = useCan();
  const [emailCopied, setEmailCopied] = useState(false);

  const canExport = can("group.export", { id: slug, isMember: true });
  const canExportPhone = can("group.export_phone", {
    id: slug,
    isMember: true,
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
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-muted-foreground text-sm">
            {googleGroupEmail}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            aria-label="Copy group email"
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
        <div className="flex items-center justify-between pb-3">
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
  availableUsers: availableUsersProp = [],
}: {
  groupDetailPromise: Promise<GroupDetail | null>;
  availableUsers?: PublicUser[];
}) {
  const can = useCan();
  const router = useRouter();
  const groupDetail = use(groupDetailPromise);

  if (!groupDetail) {
    notFound();
  }

  const [group, setGroup] = useState(groupDetail);
  const [emailCopied, setEmailCopied] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("");
  const [legalFilter, setLegalFilter] = useState<LegalMembershipState | "">("");
  const [batchFilter, setBatchFilter] = useState<number | "">("");
  const [selectedUserIds, setSelectedUserIds] = useState(new Set<string>());
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [membersPage, setMembersPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  );
  const [addParam, setAddParam] = useQueryState(
    "add",
    parseAsString.withOptions({ shallow: false }),
  );
  const isAddMemberDialogOpen = addParam !== null;

  useEffect(() => {
    setGroup(groupDetail);
  }, [groupDetail]);

  useEffect(() => {
    if (!isAddMemberDialogOpen) {
      setUserSearch("");
      setDepartmentFilter("");
      setStatusFilter("");
      setLegalFilter("");
      setBatchFilter("");
      setSelectedUserIds(new Set());
    }
  }, [isAddMemberDialogOpen]);

  const availableBatches = useMemo(() => {
    const nums = new Set<number>();
    for (const u of availableUsersProp) {
      if (u.batchNumber != null) nums.add(u.batchNumber);
    }
    return Array.from(nums).sort((a, b) => a - b);
  }, [availableUsersProp]);

  const filteredUsers = useMemo(() => {
    return availableUsersProp.filter((u) => {
      const nameMatch =
        !userSearch ||
        `${u.firstName} ${u.lastName}`
          .toLowerCase()
          .includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase());
      const deptMatch = !departmentFilter || u.department === departmentFilter;
      const statusMatch = !statusFilter || u.status === statusFilter;
      const legalMatch = !legalFilter || u.legalMembershipState === legalFilter;
      const batchMatch = batchFilter === "" || u.batchNumber === batchFilter;
      return nameMatch && deptMatch && statusMatch && legalMatch && batchMatch;
    });
  }, [
    availableUsersProp,
    userSearch,
    departmentFilter,
    statusFilter,
    legalFilter,
    batchFilter,
  ]);

  const allFilteredSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((u) => selectedUserIds.has(u.id));
  const someFilteredSelected = filteredUsers.some((u) =>
    selectedUserIds.has(u.id),
  );
  const headerUserChecked = allFilteredSelected
    ? true
    : someFilteredSelected
      ? "indeterminate"
      : false;

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected || someFilteredSelected) {
      setSelectedUserIds((prev) => {
        const next = new Set(prev);
        for (const u of filteredUsers) next.delete(u.id);
        return next;
      });
    } else {
      setSelectedUserIds((prev) => {
        const next = new Set(prev);
        for (const u of filteredUsers) next.add(u.id);
        return next;
      });
    }
  };

  const toggleUserRow = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleAddSelectedMembers = async () => {
    const ids = Array.from(selectedUserIds);
    if (ids.length === 0) return;
    setIsAddingMembers(true);
    try {
      await addUsersToGroupAction(ids, group.id);
      toast.success(
        `Added ${ids.length} member${ids.length === 1 ? "" : "s"} to the group`,
      );
      setAddParam(null);
    } catch (_error) {
      toast.error(
        "Could not add members to group. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    } finally {
      setIsAddingMembers(false);
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

  const handlePromoteToManager = async (member: GroupMember) => {
    try {
      await promoteToManagerAction(member.id, group.id);
      toast.success(`Made ${member.firstName} ${member.lastName} a manager`);
      router.refresh();
    } catch (_error) {
      toast.error(
        "Could not update role. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    }
  };

  const handleDemoteFromManager = async (member: GroupMember) => {
    try {
      await demoteFromManagerAction(member.id, group.id);
      toast.success(
        `Removed manager role from ${member.firstName} ${member.lastName}`,
      );
      router.refresh();
    } catch (_error) {
      toast.error(
        "Could not update role. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    }
  };

  const groupScope = {
    id: group.id,
    isMember: group.isMember,
    isManager: group.isGroupManager,
  };
  const canManageMembers = can("group.members.manage", groupScope);
  const canManageManagers = can("group.managers.manage", groupScope);
  const canExport = can("group.export", groupScope);
  const canExportPhone = can("group.export_phone", groupScope);
  const canViewMemberProfile = (member: GroupMember) =>
    can("user.view_details", member);

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
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {group.name}
          </h1>
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
              aria-label="Copy group email"
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
        <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
            {canManageMembers && (
              <Dialog
                open={isAddMemberDialogOpen}
                onOpenChange={(open) => {
                  if (!open) setAddParam(null);
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddParam("1")}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add members
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl flex flex-col p-0 gap-0 h-[80vh] overflow-hidden">
                  <div className="p-6 pb-4 border-b shrink-0">
                    <DialogHeader>
                      <DialogTitle>Add members to {group.name}</DialogTitle>
                      <DialogDescription>
                        Select people to add to this group.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or email..."
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={departmentFilter || "__all__"}
                          onValueChange={(v) =>
                            setDepartmentFilter(v === "__all__" ? "" : v)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="All departments" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">
                              All departments
                            </SelectItem>
                            {DEPARTMENT_IDS.map((id) => (
                              <SelectItem key={id} value={id}>
                                {DEPARTMENT_NAMES[id]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={statusFilter || "__all__"}
                          onValueChange={(v) =>
                            setStatusFilter(
                              v === "__all__" ? "" : (v as UserStatus),
                            )
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="All statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">
                              All statuses
                            </SelectItem>
                            {(
                              Object.keys(USER_STATUS_INFO) as UserStatus[]
                            ).map((s) => (
                              <SelectItem key={s} value={s}>
                                {USER_STATUS_INFO[s].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={legalFilter || "__all__"}
                          onValueChange={(v) =>
                            setLegalFilter(
                              v === "__all__"
                                ? ""
                                : (v as LegalMembershipState),
                            )
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="All legal statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">
                              All legal statuses
                            </SelectItem>
                            <SelectItem value="not_member">
                              Not a legal member
                            </SelectItem>
                            <SelectItem value="active_member">
                              Legal member
                            </SelectItem>
                            <SelectItem value="former_member">
                              Former legal member
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={
                            batchFilter === "" ? "__all__" : String(batchFilter)
                          }
                          onValueChange={(v) =>
                            setBatchFilter(v === "__all__" ? "" : Number(v))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="All batches" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">All batches</SelectItem>
                            {availableBatches.map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                Batch {n}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={headerUserChecked}
                              onCheckedChange={toggleSelectAllFiltered}
                              aria-label="Select all"
                            />
                          </TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Batch</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-center text-muted-foreground py-10 text-sm"
                            >
                              {userSearch ||
                              departmentFilter ||
                              statusFilter ||
                              legalFilter ||
                              batchFilter !== ""
                                ? "No people match your filters."
                                : "Everyone is already in this group."}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredUsers.map((u) => (
                            <TableRow
                              key={u.id}
                              className="cursor-pointer"
                              onClick={() => toggleUserRow(u.id)}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedUserIds.has(u.id)}
                                  onCheckedChange={() => toggleUserRow(u.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`Select ${u.firstName} ${u.lastName}`}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <Avatar className="h-7 w-7 text-xs shrink-0">
                                    <AvatarFallback>
                                      {u.firstName?.[0]}
                                      {u.lastName?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium text-sm">
                                      {u.firstName} {u.lastName}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {u.email}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {u.department
                                  ? (DEPARTMENT_NAMES[
                                      u.department as keyof typeof DEPARTMENT_NAMES
                                    ] ?? u.department)
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {u.batchNumber != null
                                  ? `Batch ${u.batchNumber}`
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="p-4 border-t shrink-0 flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">
                      {selectedUserIds.size > 0
                        ? `${selectedUserIds.size} selected`
                        : "No people selected"}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddParam(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={selectedUserIds.size === 0 || isAddingMembers}
                        onClick={handleAddSelectedMembers}
                      >
                        {isAddingMembers
                          ? "Adding..."
                          : selectedUserIds.size > 0
                            ? `Add ${selectedUserIds.size} member${selectedUserIds.size === 1 ? "" : "s"}`
                            : "Add members"}
                      </Button>
                    </div>
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
                {(canManageMembers || canManageManagers) && (
                  <TableHead className="w-12" />
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.totalMembers === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManageMembers || canManageManagers ? 2 : 1}
                    className="py-10 text-center text-muted-foreground text-sm"
                  >
                    No members yet.
                  </TableCell>
                </TableRow>
              ) : (
                group.members.map((member) => {
                  const canViewProfile = canViewMemberProfile(member);
                  const memberIsManager = member.role === "manager";
                  const showActions =
                    (canManageMembers && !memberIsManager) ||
                    (canManageManagers && memberIsManager);

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
                              {memberIsManager && (
                                <Crown className="h-3 w-3 text-amber-500 shrink-0" />
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      {(canManageMembers || canManageManagers) && (
                        <TableCell>
                          {showActions && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {memberIsManager ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleDemoteFromManager(member)
                                    }
                                  >
                                    <Crown className="h-4 w-4 mr-2 shrink-0" />
                                    Remove as manager
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handlePromoteToManager(member)
                                    }
                                  >
                                    <Crown className="h-4 w-4 mr-2 shrink-0" />
                                    Make manager
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleRemoveMember(member)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2 shrink-0" />
                                  Remove from group
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
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

export default function AdminGroupDetailClient(
  props: AdminGroupDetailClientProps,
) {
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
  return (
    <ManualGroupView
      groupDetailPromise={props.groupDetailPromise}
      availableUsers={props.availableUsers}
    />
  );
}
