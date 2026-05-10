"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getLegalMembershipStatus } from "./get-legal-membership-status-action";
import { PaymentButton } from "./payment-button";

export function MembershipProcessingCard() {
  const router = useRouter();

  const { data: status } = useQuery({
    queryKey: ["legal-membership-status"],
    queryFn: getLegalMembershipStatus,
    refetchInterval: (query) => {
      const current = query.state.data;
      return !current || current === "processing" ? 2000 : false;
    },
  });

  useEffect(() => {
    if (status && status !== "processing" && status !== "active") {
      router.refresh();
    }
  }, [status, router]);

  if (status === "active") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Welcome to START Berlin</CardTitle>
          <CardDescription>
            Your membership is confirmed. Set up your yearly membership payment
            to complete your onboarding.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-3">
          <PaymentButton />
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your application is being processed</CardTitle>
        <CardDescription>
          We're preparing your membership documents. This usually only takes a
          moment.
        </CardDescription>
      </CardHeader>
      <CardFooter className="items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="h-4 w-4 animate-spin" />
        Processing your documents...
      </CardFooter>
    </Card>
  );
}
