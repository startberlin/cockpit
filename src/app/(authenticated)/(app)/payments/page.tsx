import { redirect } from "next/navigation";
import {
  ALL_HISTORY_STATUSES,
  DEFAULT_HISTORY_STATUSES,
  getPaymentHistoryPage,
  getPaymentStats,
  getProposedPayments,
} from "@/db/membership-payments";
import type { MembershipPaymentCycleStatus } from "@/db/schema/membership-payments";
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
  searchParams: Promise<{
    selected?: string;
    page?: string;
    q?: string;
    statuses?: string;
  }>;
}) {
  if (!(await can("payments.manage"))) {
    redirect("/people/directory");
  }

  const {
    selected,
    page: pageParam,
    q,
    statuses: statusesParam,
  } = await searchParams;
  const rawPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const search = q?.trim() ?? undefined;

  const rawStatuses = statusesParam
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const statuses =
    rawStatuses && rawStatuses.length > 0
      ? (rawStatuses.filter((s) =>
          ALL_HISTORY_STATUSES.includes(s as MembershipPaymentCycleStatus),
        ) as MembershipPaymentCycleStatus[])
      : DEFAULT_HISTORY_STATUSES;

  const [proposed, historyRaw, stats] = await Promise.all([
    getProposedPayments(),
    getPaymentHistoryPage(rawPage, PAGE_SIZE, search, statuses),
    getPaymentStats(),
  ]);

  const historyTotalPages = Math.max(
    1,
    Math.ceil(historyRaw.total / PAGE_SIZE),
  );
  const page = Math.min(rawPage, historyTotalPages);
  const history =
    page !== rawPage
      ? await getPaymentHistoryPage(page, PAGE_SIZE, search, statuses)
      : historyRaw;

  const selectedRow = selected
    ? (proposed.find((r) => r.id === selected) ?? null)
    : null;

  const gcHistoryPromise: Promise<GcPaymentRecord[]> =
    selectedRow?.gocardlessCustomerId
      ? getGcPaymentHistoryForMember(selectedRow.gocardlessCustomerId).catch(
          () => [],
        )
      : Promise.resolve([]);

  return (
    <PaymentsPageClient
      proposed={proposed}
      history={history}
      stats={stats}
      selectedRow={selectedRow}
      gcHistoryPromise={gcHistoryPromise}
      pageSize={PAGE_SIZE}
    />
  );
}
