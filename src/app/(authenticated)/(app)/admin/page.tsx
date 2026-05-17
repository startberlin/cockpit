import { redirect } from "next/navigation";
import db from "@/db";
import { batch } from "@/db/schema/batch";
import { getCurrentUser } from "@/db/user";
import { createMetadata } from "@/lib/metadata";
import { isSuperAdmin } from "@/lib/superadmin";

import AdminPageClient, { type AdminUserRow } from "./page-client";

export const metadata = createMetadata({
  title: "Admin",
  description: "Manage users, sessions, and roles.",
});

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }

  if (!(await isSuperAdmin())) {
    redirect("/membership");
  }

  const users = await db.query.user.findMany({
    columns: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      status: true,
      createdAt: true,
    },
    orderBy: (u, { desc }) => [desc(u.createdAt)],
  });

  const batches = await db.select().from(batch).orderBy(batch.number);

  const rows: AdminUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
  }));

  return <AdminPageClient initialUsers={rows} batches={batches} />;
}
