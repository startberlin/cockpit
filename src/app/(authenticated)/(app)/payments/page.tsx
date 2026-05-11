import { redirect } from "next/navigation";
import { getAllPaymentsForPage } from "@/db/membership-payments";
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

export default async function PaymentsPage() {
  if (!(await can("payments.manage"))) {
    redirect("/people/directory");
  }

  const rows = await getAllPaymentsForPage();

  const gcHistoryMap: Record<string, GcPaymentRecord[]> = {};
  await Promise.all(
    rows
      .filter((r) => r.gocardlessCustomerId)
      .map(async (r) => {
        const customerId = r.gocardlessCustomerId as string;
        if (!(customerId in gcHistoryMap)) {
          gcHistoryMap[customerId] = await getGcPaymentHistoryForMember(
            customerId,
          ).catch(() => []);
        }
      }),
  );

  return <PaymentsPageClient rows={rows} gcHistoryMap={gcHistoryMap} />;
}
