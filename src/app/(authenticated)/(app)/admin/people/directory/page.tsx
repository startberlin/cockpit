import { redirect } from "next/navigation";
import { getAllUsersForAdmin } from "@/db/people";
import type { Department, UserStatus } from "@/db/schema/auth";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import AdminDirectoryPageClient from "./page-client";

export const metadata = createMetadata({
  title: "People",
  description: "Manage START Berlin members.",
});

interface PageProps {
  searchParams: Promise<{
    page?: string;
    q?: string;
    department?: string;
    batchNumber?: string;
    status?: string;
  }>;
}

export default async function AdminDirectoryPage({ searchParams }: PageProps) {
  if (!(await can("users.view_all"))) {
    redirect("/membership");
  }

  const {
    page: pageParam,
    q: search = "",
    department,
    batchNumber,
    status,
  } = await searchParams;

  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const batchNum = batchNumber
    ? parseInt(batchNumber, 10) || undefined
    : undefined;
  const statusFilter = status
    ? (status.split(",").filter(Boolean) as UserStatus[])
    : undefined;
  const deptFilter = department as Department | undefined;

  const usersPromise = getAllUsersForAdmin({
    page,
    search,
    department: deptFilter,
    batchNumber: batchNum,
    status: statusFilter,
  });

  return (
    <AdminDirectoryPageClient
      usersPromise={usersPromise}
      initialSearch={search}
    />
  );
}
