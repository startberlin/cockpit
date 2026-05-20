import db from "@/db";
import { getAllUserPublicData } from "@/db/people";
import { batch } from "@/db/schema/batch";
import { createMetadata } from "@/lib/metadata";

import DirectoryPageClient from "./page-client";
import { loadSearchParams } from "./search-params";

export const metadata = createMetadata({
  title: "People",
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
    page,
    q: search,
    department,
    batchNumber,
    status,
  } = await loadSearchParams(searchParams);

  const usersPromise = getAllUserPublicData({
    page: Math.max(1, page),
    search,
    department: department ?? undefined,
    batchNumber: batchNumber ?? undefined,
    status: status ?? undefined,
  });

  const batches = await db
    .select({ number: batch.number })
    .from(batch)
    .orderBy(batch.number);

  return (
    <>
      <div className="pb-6">
        <h1 className="text-xl font-semibold">People</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Everyone who's part of START Berlin.
        </p>
      </div>
      <DirectoryPageClient usersPromise={usersPromise} batches={batches} />
    </>
  );
}
