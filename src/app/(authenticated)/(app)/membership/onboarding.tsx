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
import type { UserStatus } from "@/db/schema/auth";
import type { StructuredMembershipState } from "@/lib/membership-status";
import {
  getMembershipBillingCopy,
  getMembershipToolsCopy,
} from "./billing-copy";
import { NotionDialog } from "./notion-dialog";
import { PaymentButton } from "./payment-button";
import { PaymentProcessingRefresh } from "./payment-processing-refresh";
import { SlackDialog } from "./slack-dialog";

interface MembershipPageContentProps {
  membershipState: StructuredMembershipState;
  userStatus: UserStatus;
  paidThroughAt?: Date | null;
}

export function MembershipPageContent({
  membershipState,
  userStatus,
  paidThroughAt,
}: MembershipPageContentProps) {
  const tools = getMembershipToolsCopy(userStatus);

  return (
    <div className="flex flex-col gap-10">
      <MembershipSection
        membershipState={membershipState}
        userStatus={userStatus}
        paidThroughAt={paidThroughAt}
      />
      {tools.visible && (
        <ToolsSection
          title={tools.title}
          description={tools.description}
          actionLabel={tools.actionLabel}
        />
      )}
    </div>
  );
}

function MembershipSection({
  membershipState,
  userStatus,
  paidThroughAt,
}: MembershipPageContentProps) {
  const isPaymentProcessing = membershipState.payment === "processing";
  const showPaymentButton =
    membershipState.paymentSetupAllowed && !isPaymentProcessing;
  const copy = getMembershipBillingCopy({
    mode: membershipState.payment,
    userStatus,
    paidThroughAt,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      {isPaymentProcessing && (
        <CardFooter className="items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="h-4 w-4 animate-spin" />
          Updating your membership status...
          <PaymentProcessingRefresh />
        </CardFooter>
      )}
      {showPaymentButton && (
        <CardFooter className="flex-col items-start gap-3">
          <PaymentButton />
          {copy.paymentNote && (
            <p className="text-sm text-muted-foreground">{copy.paymentNote}</p>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

function ToolsSection({
  title,
  description,
  actionLabel,
}: {
  title: string;
  description: string;
  actionLabel: string;
}) {
  const slackTitle = `${actionLabel} Slack`;
  const notionTitle = `${actionLabel} Notion`;

  return (
    <div className="flex flex-col gap-6">
      <span className="flex flex-col gap-1">
        <h2 className="text-md font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
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
            <CardTitle>{slackTitle}</CardTitle>
            <CardDescription>
              {actionLabel === "Join"
                ? "Join Slack for START Berlin communication, updates, and day-to-day coordination."
                : "Open Slack for START Berlin communication, updates, and day-to-day coordination."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <SlackDialog actionLabel={actionLabel} />
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
            <CardTitle>{notionTitle}</CardTitle>
            <CardDescription>
              {actionLabel === "Join"
                ? "Join Notion to access START Berlin resources, project docs, and internal information."
                : "Open Notion to access START Berlin resources, project docs, and internal information."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <NotionDialog actionLabel={actionLabel} />
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
