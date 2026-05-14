import { redirect } from "next/navigation";
import { getCurrentUser } from "@/db/user";
import { PaymentReturnRedirect } from "./payment-return-redirect";

export default async function PaymentReturnPage() {
  const user = await getCurrentUser();

  if (!user) {
    return redirect("/auth");
  }

  if (user.gocardlessMandateId) {
    return redirect("/membership");
  }

  return <PaymentReturnRedirect userId={user.id} />;
}
