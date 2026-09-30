import {
  ClockIcon,
  FileTextIcon,
  InfoIcon,
  LandmarkIcon,
  MailIcon,
  UserCheckIcon,
} from "lucide-react";
import type React from "react";
import type { MembershipNoticeType } from "@/app/(authenticated)/(app)/(default)/membership/membership-notice-state";
import { cn } from "@/lib/utils";

interface AdminMembershipNoticeBlockProps {
  noticeType: MembershipNoticeType | "admission_pending" | "processing";
  canViewPayment: boolean;
}

function NoticePanel({
  icon,
  title,
  body,
  className,
  iconClassName,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-4 items-start border p-4 rounded-lg",
        className ?? "bg-blue-50 border-blue-200",
      )}
    >
      <span className={cn("shrink-0 mt-0.5", iconClassName)}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm leading-snug">{title}</div>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          {body}
        </p>
      </div>
    </div>
  );
}

export function AdminMembershipNoticeBlock({
  noticeType,
  canViewPayment,
}: AdminMembershipNoticeBlockProps) {
  if (!noticeType) return null;

  if (noticeType === "admission_pending") {
    return (
      <NoticePanel
        icon={<ClockIcon className="size-4" />}
        title="Board admission vote pending"
        body="This member has already been proposed for membership. The board admission vote is still pending."
      />
    );
  }

  if (noticeType === "alumni") {
    return (
      <NoticePanel
        icon={<InfoIcon className="size-4" />}
        title="Listed as alumni"
        body="This member is an alumnus of START Berlin e.V. and is no longer an active member."
        className="bg-secondary/50 border-border"
        iconClassName="text-muted-foreground"
      />
    );
  }

  if (noticeType === "application_pending") {
    return (
      <NoticePanel
        icon={<FileTextIcon className="size-4" />}
        title="Membership application pending"
        body="The board has approved this member. They need to submit their membership application in My membership before their legal membership can be activated."
      />
    );
  }

  if (noticeType === "membership_reconfirmation_pending") {
    return (
      <NoticePanel
        icon={<UserCheckIcon className="size-4" />}
        title="Membership reconfirmation pending"
        body="This member needs to reconfirm their membership details before their membership can continue."
      />
    );
  }

  if (noticeType === "processing") {
    return (
      <NoticePanel
        icon={<ClockIcon className="size-4" />}
        title="Membership application processing"
        body="This member has submitted their membership application. Their legal documents are being prepared before membership activation."
      />
    );
  }

  if (noticeType === "manual_followup") {
    return (
      <NoticePanel
        icon={<MailIcon className="size-4" />}
        title="Manual follow-up required"
        body="This member's application requires manual review by the board before it can proceed."
        className="bg-secondary/50 border-border"
        iconClassName="text-muted-foreground"
      />
    );
  }

  if (noticeType === "transition_pending") {
    return (
      <NoticePanel
        icon={<ClockIcon className="size-4" />}
        title="Membership transition pending"
        body="A membership status transition for this member is awaiting board approval."
        className="bg-amber-50 border-amber-200"
        iconClassName="text-amber-600"
      />
    );
  }

  if (noticeType === "payment_cancelled") {
    if (!canViewPayment) return null;
    return (
      <NoticePanel
        icon={<LandmarkIcon className="size-4" />}
        title="Direct debit cancelled"
        body="This member's direct debit mandate has been cancelled. They need to set up a new one to continue their membership."
      />
    );
  }

  if (noticeType === "payment_not_started") {
    if (!canViewPayment) return null;
    return (
      <NoticePanel
        icon={<LandmarkIcon className="size-4" />}
        title="Direct debit not set up"
        body="This member has not yet set up their direct debit payment. They need to complete this step to activate their membership."
      />
    );
  }

  return null;
}
