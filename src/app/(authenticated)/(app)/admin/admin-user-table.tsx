"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { authClient } from "@/lib/auth-client";
import type { AdminUserRow } from "./page-client";
import { UserSessionsSheet } from "./user-sessions-sheet";

interface AdminUserTableProps {
  initialUsers: AdminUserRow[];
}

export function AdminUserTable({ initialUsers }: AdminUserTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [sessionsUser, setSessionsUser] = useState<AdminUserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUserRow | null>(null);

  const filtered = initialUsers.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const refresh = () => router.refresh();

  const impersonate = async (user: AdminUserRow) => {
    setPendingId(user.id);
    const result = await authClient.admin.impersonateUser({ userId: user.id });
    setPendingId(null);
    if (result.error) {
      toast.error(result.error.message ?? "Failed to impersonate");
      return;
    }
    toast.success(`Now impersonating ${user.email}`);
    router.push("/membership");
    router.refresh();
  };

  const setRole = async (user: AdminUserRow, role: "user" | "admin") => {
    if (user.role === role) return;
    setPendingId(user.id);
    const result = await authClient.admin.setRole({ userId: user.id, role });
    setPendingId(null);
    if (result.error) {
      toast.error(result.error.message ?? "Failed to update role");
      return;
    }
    toast.success(`Role set to ${role}`);
    refresh();
  };

  const revokeAllSessions = async (user: AdminUserRow) => {
    setPendingId(user.id);
    const result = await authClient.admin.revokeUserSessions({
      userId: user.id,
    });
    setPendingId(null);
    if (result.error) {
      toast.error(result.error.message ?? "Failed to revoke sessions");
      return;
    }
    toast.success("All sessions revoked");
  };

  const performDelete = async () => {
    if (!deleteUser) return;
    setPendingId(deleteUser.id);
    const result = await authClient.admin.removeUser({
      userId: deleteUser.id,
    });
    setPendingId(null);
    if (result.error) {
      toast.error(result.error.message ?? "Failed to delete user");
      return;
    }
    toast.success("User deleted");
    setDeleteUser(null);
    refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Search by name, email, or role…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-sm text-muted-foreground"
                >
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.role === "admin" ? "default" : "secondary"}
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={pendingId === user.id}
                          aria-label="User actions"
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => impersonate(user)}>
                          Impersonate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSessionsUser(user)}>
                          View sessions
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => revokeAllSessions(user)}
                        >
                          Revoke all sessions
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            Set role
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem
                              onClick={() => setRole(user, "user")}
                              disabled={user.role === "user"}
                            >
                              user
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setRole(user, "admin")}
                              disabled={user.role === "admin"}
                            >
                              admin
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteUser(user)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {sessionsUser && (
        <UserSessionsSheet
          open={!!sessionsUser}
          onOpenChange={(open) => !open && setSessionsUser(null)}
          userId={sessionsUser.id}
          userLabel={`${sessionsUser.name} · ${sessionsUser.email}`}
        />
      )}

      <AlertDialog
        open={!!deleteUser}
        onOpenChange={(open) => !open && setDeleteUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteUser?.email ?? "user"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the user and all related data. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={performDelete}>
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
