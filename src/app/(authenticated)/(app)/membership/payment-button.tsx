"use client";

import { CreditCard } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { handleError } from "@/lib/utils";
import { startMembershipPaymentAction } from "./start-payment-action";

export function PaymentButton() {
  const { execute, status } = useAction(startMembershipPaymentAction, {
    onSuccess: ({ data }) => {
      if (!data?.hostedUrl) {
        toast.error("Could not start payment setup.");
        return;
      }

      window.location.href = data.hostedUrl;
    },
    onError: handleError,
  });

  const isLoading = status === "executing";

  return (
    <Button type="button" onClick={() => execute()} disabled={isLoading}>
      <CreditCard />
      {isLoading ? "Opening payment..." : "Set up payment"}
    </Button>
  );
}
