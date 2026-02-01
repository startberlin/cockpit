"use client";

import {
  ArrowLeft,
  Crown,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Can } from "@/components/can";
import GroupCriteriaManager from "@/components/group-criteria-manager";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { GroupDetail, GroupMember } from "@/db/groups";
import type { PublicUser } from "@/db/people";
import { hasAnyRequiredRole, PERMISSIONS } from "@/lib/permissions";
import { useRoles } from "@/lib/permissions/roles-context";
import {
  addUserToGroupAction,
  removeUserFromGroupAction,
  searchUsersNotInGroupAction,
  updateUserGroupRoleAction,
} from "./actions";

interface GroupDetailClientProps {
  group: GroupDetail;
}

export default function GroupDetailClient({
  group: initialGroup,
}: GroupDetailClientProps) {
  const [group, setGroup] = useState(initialGroup);
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const roles = useRoles();
  const canManageUsers = hasAnyRequiredRole(roles, PERMISSIONS["users.manage"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load available users when dialog opens
  useEffect(() => {
    if (isAddMemberDialogOpen) {
      loadAvailableUsers();
    }
  }, [isAddMemberDialogOpen]);

  const loadAvailableUsers = async (query?: string) => {
    setIsSearching(true);
    try {
      const result = await searchUsersNotInGroupAction(group.id, query);
      setSearchResults(result);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    await loadAvailableUsers(query || undefined);
  };

  const handleAddMember = async (
    user: PublicUser,
    role: "admin" | "member" = "member",
  ) => {
    try {
      await addUserToGroupAction(user.id, group.id, role);

      const newMember: GroupMember = {
        ...user,
        role,
      };

      setGroup((prev) => ({
        ...prev,
        members: [...prev.members, newMember].sort((a, b) => {
          if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
          return `${a.firstName} ${a.lastName}`.localeCompare(
            `${b.firstName} ${b.lastName}`,
          );
        }),
      }));

      setIsAddMemberDialogOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      toast.success(`Added ${user.firstName} ${user.lastName} to the group`);
    } catch (error) {
      toast.error("Failed to add member to group");
    }
  };

  const handleRemoveMember = async (member: GroupMember) => {
    try {
      await removeUserFromGroupAction(member.id, group.id);

      setGroup((prev) => ({
        ...prev,
        members: prev.members.filter((m) => m.id !== member.id),
      }));

      toast.success(
        `Removed ${member.firstName} ${member.lastName} from the group`,
      );
    } catch (error) {
      toast.error("Failed to remove member from group");
    }
  };

  const handleRoleChange = async (
    member: GroupMember,
    newRole: "admin" | "member",
  ) => {
    try {
      await updateUserGroupRoleAction(member.id, group.id, newRole);

      setGroup((prev) => ({
        ...prev,
        members: prev.members
          .map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
          .sort((a, b) => {
            if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
            return `${a.firstName} ${a.lastName}`.localeCompare(
              `${b.firstName} ${b.lastName}`,
            );
          }),
      }));

      toast.success(
        `Changed ${member.firstName} ${member.lastName}'s role to ${newRole}`,
      );
    } catch (error) {
      toast.error("Failed to update member role");
    }
  };

  const handleCriteriaChange = async () => {
    try {
      // Fetch updated criteria
      const criteriaResponse = await fetch(`/api/groups/${group.id}/criteria`);
      if (!criteriaResponse.ok) {
        throw new Error("Failed to fetch updated criteria");
      }

      const { criteria } = await criteriaResponse.json();

      // Also refresh group details to get updated member list
      const groupResponse = await fetch(`/api/groups/${group.id}`);
      let updatedMembers = group.members; // fallback to current members

      if (groupResponse.ok) {
        const groupData = await groupResponse.json();
        updatedMembers = groupData.members || group.members;
      }

      setGroup((prev) => ({
        ...prev,
        criteria: criteria,
        members: updatedMembers,
      }));
    } catch (error) {
      console.error("Error refreshing criteria:", error);
      // We'll still show a toast error but won't prevent the UI from working
    }
  };

  const adminCount = group.members.filter((m) => m.role === "admin").length;
  const memberCount = group.members.filter((m) => m.role === "member").length;

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/groups">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {group.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              <span className="font-mono">#{group.slug}</span>
              <span className="mx-2">·</span>
              <span>{group.slug}@start-berlin.com</span>
            </p>
          </div>
        </div>

        <Can permission="groups.manage_members">
          <div className="flex gap-2">
            <Dialog
              open={isAddMemberDialogOpen}
              onOpenChange={setIsAddMemberDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Member to {group.name}</DialogTitle>
                  <DialogDescription>
                    Search for users to add to this group.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {isSearching && (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
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
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddMember(user, "member")}
                            >
                              <UserPlus className="h-3 w-3 mr-1" />
                              Member
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleAddMember(user, "admin")}
                            >
                              <Crown className="h-3 w-3 mr-1" />
                              Admin
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchQuery &&
                    !isSearching &&
                    searchResults.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        No users found matching "{searchQuery}"
                      </div>
                    )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </Can>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{group.members.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Administrators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adminCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Auto-Add Criteria Section */}
      <Can permission="groups.manage_members">
        <Card>
          <CardContent className="p-6">
            <GroupCriteriaManager
              groupId={group.id}
              criteria={group.criteria}
              onCriteriaChange={handleCriteriaChange}
            />
          </CardContent>
        </Card>
      </Can>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            All members of this group and their roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {group.members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No members in this group yet.
            </div>
          ) : (
            <div className="space-y-4">
              {group.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {member.firstName[0]}
                        {member.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/people/${member.id}`}
                          className="font-medium hover:underline"
                        >
                          {member.firstName} {member.lastName}
                        </Link>
                        <Badge
                          variant={
                            member.role === "admin" ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {member.role === "admin" && (
                            <Crown className="h-3 w-3 mr-1" />
                          )}
                          {member.role}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {member.email}
                      </div>
                      {member.department && (
                        <div className="text-xs text-muted-foreground capitalize">
                          {member.department}
                        </div>
                      )}
                    </div>
                  </div>

                  <Can permission="groups.manage_members">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {member.role === "member" ? (
                          <DropdownMenuItem
                            onClick={() => handleRoleChange(member, "admin")}
                          >
                            <Crown className="h-4 w-4 mr-2" />
                            Make Admin
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleRoleChange(member, "member")}
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Make Member
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleRemoveMember(member)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove from Group
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Can>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
