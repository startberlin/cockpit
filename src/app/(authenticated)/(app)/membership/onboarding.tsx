import { Loader2Icon } from "lucide-react";
import Image from "next/image";
import NotionIcon from "@/assets/notion-logo.svg";
import SlackIcon from "@/assets/slack-icon.svg";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NotionDialog } from "./notion-dialog";
import { PaymentButton } from "./payment-button";
import { PaymentProcessingRefresh } from "./payment-processing-refresh";
import { SlackDialog } from "./slack-dialog";

interface MembershipOnboardingProps {
  mode?: "profile_onboarding" | "payment_pending" | "payment_processing";
}

export function MembershipOnboarding({
  mode = "profile_onboarding",
}: MembershipOnboardingProps) {
  const isPaymentPending = mode === "payment_pending";
  const isPaymentProcessing = mode === "payment_processing";

  return (
    <div className="flex flex-col gap-10">
      <Card>
        <CardHeader>
          <CardTitle>
            {isPaymentProcessing
              ? "Confirming your payment setup."
              : isPaymentPending
                ? "Finalize your membership."
                : "You're in the onboarding phase."}
          </CardTitle>
          <CardDescription>
            {isPaymentProcessing
              ? "We're waiting for GoCardless to confirm your membership payment setup. This usually takes a moment."
              : isPaymentPending
                ? "Your onboarding details are complete. Set up your yearly membership payment to become a full member."
                : "We're glad to have you on board. After the onboarding phase, you'll see your membership details here."}
          </CardDescription>
        </CardHeader>
        {isPaymentProcessing && (
          <CardFooter className="items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="h-4 w-4 animate-spin" />
            Updating your membership status...
            <PaymentProcessingRefresh />
          </CardFooter>
        )}
        {isPaymentPending && (
          <CardFooter>
            <PaymentButton />
          </CardFooter>
        )}
      </Card>
      <div className="flex flex-col gap-6">
        <span className="flex flex-col gap-1">
          <h2 className="text-md font-semibold">First steps</h2>
          <p className="text-sm text-muted-foreground">
            Set up your most important software accounts
          </p>
        </span>
        <div className="grid md:grid-cols-3 grid-cols-1 sm:grid-cols-2 gap-2">
          <Card className="@container/card">
            <CardHeader className="gap-2">
              <Image
                src={SlackIcon}
                className="mb-3"
                alt="Slack"
                width={24}
                height={24}
              />
              <CardTitle>Join Slack</CardTitle>
              <CardDescription>
                Set up your Slack account to stay updated with the latest news
                and announcements.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <SlackDialog />
            </CardFooter>
          </Card>
          <Card className="@container/card">
            <CardHeader className="gap-2">
              <Image
                src={NotionIcon}
                className="mb-3"
                alt="Notion"
                width={24}
                height={24}
              />
              <CardTitle>Join Notion</CardTitle>
              <CardDescription>
                Set up your Notion account to collaborate on projects, tasks
                management and more.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <NotionDialog />
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
