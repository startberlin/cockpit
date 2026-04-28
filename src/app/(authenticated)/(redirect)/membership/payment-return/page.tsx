import { redirect } from "next/navigation";
import { createLoader, parseAsString } from "nuqs/server";
import { getCurrentUser } from "@/db/user";
import { PaymentReturnRedirect } from "./payment-return-redirect";

const loadSearchParams = createLoader({
  id: parseAsString,
  billing_request_flow_id: parseAsString,
  flow_id: parseAsString,
});

interface PageProps {
  searchParams: Promise<{
    id?: string;
    billing_request_flow_id?: string;
    flow_id?: string;
  }>;
}

export default async function PaymentReturnPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return redirect("/auth");
  }

  const params = await loadSearchParams(searchParams);
  const billingRequestFlowId =
    params.id ?? params.billing_request_flow_id ?? params.flow_id;

  return <PaymentReturnRedirect billingRequestFlowId={billingRequestFlowId} />;
}
