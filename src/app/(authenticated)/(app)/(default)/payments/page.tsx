import { redirect } from "next/navigation";
import * as React from "react";
import {
  ALL_HISTORY_STATUSES,
  DEFAULT_HISTORY_STATUSES,
  getPaymentHistoryPage,
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
import PaymentStatsSection from "./payment-stats-section";
import {
  PaymentStatsSkeleton,
  ProposedPaymentsSkeleton,
} from "./payments-skeletons";
import ProposedPaymentsSection from "./proposed-payments-section";

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
    redirect("/membership");
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

  const historyRaw = await getPaymentHistoryPage(
    rawPage,
    PAGE_SIZE,
    search,
    statuses,
  );

  const historyTotalPages = Math.max(
    1,
    Math.ceil(historyRaw.total / PAGE_SIZE),
  );
  const page = Math.min(rawPage, historyTotalPages);
  const history =
    page !== rawPage
      ? await getPaymentHistoryPage(page, PAGE_SIZE, search, statuses)
      : historyRaw;

  const proposed = selected ? await getProposedPayments() : null;

  const selectedRow =
    selected && proposed
      ? (proposed.find((r) => r.id === selected) ?? null)
      : null;

  const gcHistoryPromise: Promise<GcPaymentRecord[]> =
    selectedRow?.gocardlessCustomerId
      ? getGcPaymentHistoryForMember(selectedRow.gocardlessCustomerId).catch(
          () => [],
        )
      : Promise.resolve([]);

  return (
    <>
      <div className="pb-6">
        <h1 className="text-xl font-semibold">Payments</h1>
        <p className="text-muted-foreground text-sm mt-1">
          When a member's annual fee comes due, START Cockpit proposes a charge
          here. Review their mandate and payment history, then approve to
          collect the payment.
        </p>
      </div>

      <React.Suspense fallback={<PaymentStatsSkeleton />}>
        <PaymentStatsSection />
      </React.Suspense>

      <React.Suspense fallback={<ProposedPaymentsSkeleton />}>
        <ProposedPaymentsSection />
      </React.Suspense>

      <PaymentsPageClient
        history={history}
        selectedRow={selectedRow}
        gcHistoryPromise={gcHistoryPromise}
        pageSize={PAGE_SIZE}
      />
    </>
  );
}
