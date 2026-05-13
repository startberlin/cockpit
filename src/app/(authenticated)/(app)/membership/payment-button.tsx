"use client";

import { LandmarkIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { handleError } from "@/lib/utils";
import { startMembershipPaymentAction } from "./start-payment-action";

interface PaymentButtonProps {
  variant?: "setup" | "update";
}

export function PaymentButton({ variant = "setup" }: PaymentButtonProps) {
  const { execute, status } = useAction(startMembershipPaymentAction, {
    onSuccess: ({ data }) => {
      if (!data?.hostedUrl) {
        toast.error(
          "Could not start payment setup. Please try again. If this keeps happening, email operations@start-berlin.com.",
        );
        return;
      }

      window.location.href = data.hostedUrl;
    },
    onError: handleError,
  });

  const isLoading = status === "executing";
  const label =
    variant === "update" ? "Update direct debit" : "Set up direct debit";

  return (
    <Button
      size="sm"
      type="button"
      onClick={() => execute()}
      disabled={isLoading}
    >
      {isLoading ? "Opening bank authorization..." : label}
    </Button>
  );
}
