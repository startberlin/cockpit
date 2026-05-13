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
import type { Department, UserStatus } from "@/db/schema/auth";
import type { LegalMembershipStatus } from "@/db/schema/legal-membership";
import type { MembershipPaymentCycleStatus } from "@/db/schema/membership-payments";
import type { StructuredMembershipState } from "@/lib/membership-status";
import { ContactDetailsCard } from "./contact-details-card";
import { MembershipDetailsCard } from "./membership-details-card";
import { MembershipHeroCard } from "./membership-hero-card";
import { MembershipNoticeBlock } from "./membership-notice-block";
import { deriveMembershipNotice } from "./membership-notice-state";
import { NotionDialog } from "./notion-dialog";
import { SlackDialog } from "./slack-dialog";

interface ContactDetails {
  email: string;
  personalEmail: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
}

interface MembershipDetails {
  memberSince: Date | null;
  batchNumber: number | null;
  department: Department | null;
  departmentHead: {
    firstName: string;
    lastName: string;
    image: string | null;
  } | null;
  paymentTerm: {
    activationDate: string;
    status: MembershipPaymentCycleStatus;
  } | null;
  showBillingInfo: boolean;
}

interface MembershipPageContentProps {
  membershipState: StructuredMembershipState;
  userStatus: UserStatus;
  firstName: string;
  activeLegalMembership?: { id: string; status: LegalMembershipStatus } | null;
  contactDetails: ContactDetails;
  membershipDetails: MembershipDetails;
}

export function MembershipPageContent({
  membershipState,
  userStatus,
  firstName,
  activeLegalMembership,
  contactDetails,
  membershipDetails,
}: MembershipPageContentProps) {
  const legalMembershipStatus = activeLegalMembership?.status ?? null;
  const noticeType = deriveMembershipNotice(
    membershipState,
    legalMembershipStatus,
    userStatus,
  );
  const showTools = userStatus !== "alumni";
  const toolsActionLabel = userStatus === "onboarding" ? "Join" : "Open";
  const showMembershipDetails = userStatus !== "onboarding";

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <MembershipHeroCard
          membershipState={membershipState}
          legalMembershipStatus={legalMembershipStatus}
          userStatus={userStatus}
          firstName={firstName}
          noticeType={noticeType}
        />
        <MembershipNoticeBlock
          membershipState={membershipState}
          legalMembershipStatus={legalMembershipStatus}
          userStatus={userStatus}
        />
      </div>
      {showMembershipDetails && (
        <MembershipDetailsCard {...membershipDetails} />
      )}
      <ContactDetailsCard {...contactDetails} />
      {showTools && (
        <ToolsSection
          title={
            userStatus === "onboarding"
              ? "Get connected"
              : "My START Berlin tools"
          }
          description={
            userStatus === "onboarding"
              ? "Join the START Berlin workspaces where members coordinate, share resources, and work on projects."
              : "Open the workspaces you use for communication, projects, and resources."
          }
          actionLabel={toolsActionLabel}
        />
      )}
    </div>
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
        <h2 className="text-sm font-semibold">{title}</h2>
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
