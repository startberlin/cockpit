import { redirect } from "next/navigation";
import {
  getApprovedPaymentsPage,
  getDeclinedPaymentsPage,
  getPaymentStats,
  getProposedPayments,
} from "@/db/membership-payments";
import {
  type GcPaymentRecord,
  getGcPaymentHistoryForMember,
} from "@/lib/gocardless/payments";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import PaymentsPageClient from "./page-client";

export const metadata = createMetadata({
  title: "Payments",
  description: "Review and approve member payment proposals.",
});

const PAGE_SIZE = 20;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ selected?: string; page?: string; dpage?: string }>;
}) {
  if (!(await can("payments.manage"))) {
    redirect("/people/directory");
  }

  const { selected, page: pageParam, dpage: dpageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const dpage = Math.max(1, Number.parseInt(dpageParam ?? "1", 10) || 1);

  const [proposed, approved, declined, stats] = await Promise.all([
    getProposedPayments(),
    getApprovedPaymentsPage(page, PAGE_SIZE),
    getDeclinedPaymentsPage(dpage, PAGE_SIZE),
    getPaymentStats(),
  ]);

  // Selected row can only come from proposed or declined — approved rows are not clickable.
  const selectedRow = selected
    ? (proposed.find((r) => r.id === selected) ??
      declined.rows.find((r) => r.id === selected) ??
      null)
    : null;

  // Start the GC fetch without awaiting — streamed to client via React.use() + Suspense.
  // Only fetch for proposed rows (declined show reason instead of GC history).
  const gcHistoryPromise: Promise<GcPaymentRecord[]> =
    selectedRow?.gocardlessCustomerId && selectedRow.status !== "declined"
      ? getGcPaymentHistoryForMember(selectedRow.gocardlessCustomerId).catch(
          () => [],
        )
      : Promise.resolve([]);

  return (
    <PaymentsPageClient
      proposed={proposed}
      approved={approved}
      declined={declined}
      stats={stats}
      selectedRow={selectedRow}
      gcHistoryPromise={gcHistoryPromise}
      pageSize={PAGE_SIZE}
    />
  );
}
