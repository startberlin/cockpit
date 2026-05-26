import { redirect } from "next/navigation";
import { getCurrentUser } from "@/db/user";
import { PaymentReturnRedirect } from "./payment-return-redirect";

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ billing_request_id?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return redirect("/auth");
  }

  if (user.gocardlessMandateId) {
    return redirect("/membership");
  }

  const { billing_request_id: billingRequestId } = await searchParams;

  return <PaymentReturnRedirect billingRequestId={billingRequestId} />;
}
