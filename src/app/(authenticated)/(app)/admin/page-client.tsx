"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Department, UserStatus } from "@/db/schema";
import { AdminBulkCreateForm } from "./admin-bulk-create-form";
import { AdminCreateUserForm } from "./admin-create-user-form";
import { AdminUserTable } from "./admin-user-table";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  department: Department | null;
  status: UserStatus;
  createdAt: string;
}

interface AdminPageClientProps {
  initialUsers: AdminUserRow[];
  batches: { number: number }[];
}

export default function AdminPageClient({
  initialUsers,
  batches,
}: AdminPageClientProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage users, impersonate, and review sessions.
        </p>
      </div>
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="create">Create user</TabsTrigger>
          <TabsTrigger value="bulk">Bulk create</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <AdminUserTable initialUsers={initialUsers} />
        </TabsContent>
        <TabsContent value="create" className="mt-4 max-w-2xl">
          <AdminCreateUserForm batches={batches} />
        </TabsContent>
        <TabsContent value="bulk" className="mt-4 max-w-2xl">
          <AdminBulkCreateForm batches={batches} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
