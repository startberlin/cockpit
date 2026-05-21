import { getProposedPayments } from "@/db/membership-payments";
import { ProposedPaymentsTable } from "./proposed-payments-table";

export default async function ProposedPaymentsSection() {
  const proposed = await getProposedPayments();

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-4 pb-3">
        <h2 className="text-sm font-semibold">Proposed payments</h2>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {proposed.length} proposal{proposed.length === 1 ? "" : "s"}
        </span>
      </div>
      <ProposedPaymentsTable proposed={proposed} />
    </div>
  );
}
