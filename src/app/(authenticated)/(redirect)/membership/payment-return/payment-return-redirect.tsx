"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { finalizeMembershipPaymentAction } from "./finalize-payment-action";

export function PaymentReturnRedirect({
  billingRequestFlowId,
}: {
  billingRequestFlowId?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function finalizePayment() {
      const result = await finalizeMembershipPaymentAction({
        billingRequestFlowId,
      });

      if (!active) return;

      if (result.status === "activated" || result.status === "already_active") {
        router.replace(result.hostedRedirect);
        return;
      }

      setError(
        "message" in result
          ? result.message
          : "We could not finish setting up your membership payment.",
      );
    }

    finalizePayment();

    return () => {
      active = false;
    };
  }, [billingRequestFlowId, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      {error ? (
        <div className="max-w-sm px-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            className="mt-4 text-sm font-medium underline underline-offset-4"
            onClick={() => router.replace("/membership")}
          >
            Back to membership
          </button>
        </div>
      ) : (
        <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
      )}
    </main>
  );
}
