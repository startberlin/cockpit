import db from "@/db";
import { getAllUserPublicData } from "@/db/people";
import type { Department, UserStatus } from "@/db/schema/auth";
import { batch } from "@/db/schema/batch";
import { createMetadata } from "@/lib/metadata";

import DirectoryPageClient from "./page-client";

export const metadata = createMetadata({
  title: "Directory",
  description: "Browse START Berlin members.",
});

interface DirectoryPageProps {
  searchParams: Promise<{
    page?: string;
    q?: string;
    department?: string;
    batchNumber?: string;
    status?: string;
  }>;
}

export default async function DirectoryPage({
  searchParams,
}: DirectoryPageProps) {
  const {
    page: pageParam,
    q: search = "",
    department: departmentParam,
    batchNumber: batchNumberParam,
    status: statusParam,
  } = await searchParams;

  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const department = departmentParam as Department | undefined;
  const batchNumber = batchNumberParam
    ? parseInt(batchNumberParam, 10) || undefined
    : undefined;
  const statusFilter = statusParam
    ? (statusParam.split(",").filter(Boolean) as UserStatus[])
    : undefined;

  const usersPromise = getAllUserPublicData({
    page,
    search,
    department,
    batchNumber,
    status: statusFilter,
  });

  const batches = await db
    .select({ number: batch.number })
    .from(batch)
    .orderBy(batch.number);

  return (
    <DirectoryPageClient
      usersPromise={usersPromise}
      batches={batches}
      pageCount={1}
      initialFilters={{
        search,
        department: departmentParam ?? "",
        batchNumber: batchNumber ?? null,
        status: statusParam ?? "",
      }}
    />
  );
}
