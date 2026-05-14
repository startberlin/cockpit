import Image from "next/image";
import { Suspense } from "react";
import NotionIcon from "@/assets/notion-logo.svg";
import SlackIcon from "@/assets/slack-icon.svg";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActiveLegalMembership } from "@/db/membership";
import type { User } from "@/db/schema/auth";
import { getStructuredMembershipState } from "@/lib/membership-status";
import { ContactDetailsCard } from "./contact-details-card";
import { MembershipDetailsCard } from "./membership-details-card";
import { MembershipDetailsSkeleton } from "./membership-details-skeleton";
import { MembershipHeroCard } from "./membership-hero-card";
import { MembershipNoticeBlock } from "./membership-notice-block";
import { deriveMembershipNotice } from "./membership-notice-state";
import { NotionDialog } from "./notion-dialog";
import { SlackDialog } from "./slack-dialog";

interface MembershipPageContentProps {
  user: User;
}

export async function MembershipPageContent({
  user,
}: MembershipPageContentProps) {
  // Per-request deduplication only — not a persistent cache
  const activeLegalMembership = await getActiveLegalMembership(user.id);

  const membershipState = getStructuredMembershipState(user);
  const legalMembershipStatus = activeLegalMembership?.status ?? null;
  const noticeType = deriveMembershipNotice(
    membershipState,
    legalMembershipStatus,
    user.status,
  );
  const showTools = user.status !== "alumni";
  const toolsActionLabel = user.status === "onboarding" ? "Join" : "Open";
  const showMembershipDetails = user.status !== "onboarding";

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <MembershipHeroCard
          membershipState={membershipState}
          legalMembershipStatus={legalMembershipStatus}
          legalMembershipId={activeLegalMembership?.id ?? null}
          userStatus={user.status}
          firstName={user.firstName}
          noticeType={noticeType}
        />
        <MembershipNoticeBlock
          membershipState={membershipState}
          legalMembershipStatus={legalMembershipStatus}
          userStatus={user.status}
        />
      </div>
      {showMembershipDetails && (
        <Suspense fallback={<MembershipDetailsSkeleton />}>
          <MembershipDetailsCard user={user} />
        </Suspense>
      )}
      <ContactDetailsCard user={user} />
      {showTools && (
        <ToolsSection
          title={
            user.status === "onboarding"
              ? "Get connected"
              : "My START Berlin tools"
          }
          description={
            user.status === "onboarding"
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
