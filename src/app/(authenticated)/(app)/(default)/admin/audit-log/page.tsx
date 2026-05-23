import { redirect } from "next/navigation";
import { getAuditLogPage } from "@/db/audit-log";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import AuditLogPageClient from "./page-client";

export const metadata = createMetadata({
  title: "Audit log",
  description: "Every noteworthy event across the app.",
});

const PAGE_SIZE = 25;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await can("audit_log.read"))) {
    redirect("/membership");
  }

  const params = await searchParams;
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const q = Array.isArray(params.q) ? params.q[0] : params.q;
  const category = Array.isArray(params.category)
    ? params.category[0]
    : params.category;
  const rawPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const search = q?.trim() || undefined;
  const categoryFilter = category?.trim() || undefined;

  const { rows, total } = await getAuditLogPage(
    rawPage,
    PAGE_SIZE,
    search,
    categoryFilter,
  );

  return (
    <>
      <div className="pb-6">
        <h1 className="text-xl font-semibold">Audit log</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Every change to members, groups, batches, and payments.
        </p>
      </div>

      <AuditLogPageClient rows={rows} total={total} pageSize={PAGE_SIZE} />
    </>
  );
}
