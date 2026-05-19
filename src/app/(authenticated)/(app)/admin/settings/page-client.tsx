"use client";

import { AuthorityEditor } from "@/components/authority-editor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UserWithAuthority } from "@/db/authority";

interface AdminSettingsPageClientProps {
  users: UserWithAuthority[];
  canSetSuperAdmin: boolean;
}

export default function AdminSettingsPageClient({
  users,
  canSetSuperAdmin,
}: AdminSettingsPageClientProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage member positions and app permissions across START Cockpit.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roles &amp; Permissions</CardTitle>
          <CardDescription>
            Assign org positions and admin access to members. Changes take
            effect immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No roles or permissions assigned yet.
            </p>
          ) : (
            users.map((user, index) => (
              <div key={user.userId} className="space-y-3">
                <div>
                  <p className="font-medium text-sm">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <AuthorityEditor
                  userId={user.userId}
                  positions={user.positions}
                  grants={user.grants}
                  canSetSuperAdmin={canSetSuperAdmin}
                />
                {index < users.length - 1 && <hr className="border-border" />}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
