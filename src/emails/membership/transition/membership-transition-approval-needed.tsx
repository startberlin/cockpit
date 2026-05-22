import { Heading, Text } from "react-email";
import { EmailCta } from "@/emails/components/email-cta";
import { EmailDetailBlock } from "@/emails/components/email-detail-block";
import { EmailReminderBanner } from "@/emails/components/email-reminder-banner";
import { EmailShell } from "@/emails/components/email-shell";

type TransitionType = "alumni_request" | "supporting_alumni_request";

const TRANSITION_LABELS: Record<TransitionType, string> = {
  alumni_request: "alumni",
  supporting_alumni_request: "supporting alumni",
};

interface MembershipTransitionApprovalNeededEmailProps {
  firstName: string;
  subjectName: string;
  transitionType: TransitionType;
  requestedAt: string;
  profileUrl: string;
  receivingReason?: string;
  isReminder?: boolean;
  daysOpen?: number;
}

export const MembershipTransitionApprovalNeededEmail = ({
  firstName,
  subjectName,
  transitionType,
  requestedAt,
  profileUrl,
  receivingReason,
  isReminder,
  daysOpen,
}: MembershipTransitionApprovalNeededEmailProps) => {
  const label = TRANSITION_LABELS[transitionType];

  return (
    <EmailShell
      preview={`Action required: review ${subjectName}'s transition to ${label}`}
      eyebrow="Membership"
      footerAudience="board"
      receivingReason={receivingReason}
    >
      {isReminder && daysOpen !== undefined && (
        <EmailReminderBanner daysOpen={daysOpen} />
      )}
      <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
        {subjectName} wants to become {label} and requires your approval
      </Heading>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        Hi {firstName},
      </Text>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        <strong style={{ color: "#1C1917" }}>{subjectName}</strong> has
        requested to become{" "}
        <strong style={{ color: "#1C1917" }}>{label}</strong> of START Berlin.
        Please review and approve or decline the request in START Cockpit.
      </Text>
      <EmailDetailBlock
        rows={[
          { label: "Member", value: subjectName },
          {
            label: "Transition type",
            value: label.charAt(0).toUpperCase() + label.slice(1),
          },
          { label: "Requested on", value: requestedAt },
        ]}
      />
      <EmailCta href={profileUrl} label="Review in START Cockpit" />
    </EmailShell>
  );
};

MembershipTransitionApprovalNeededEmail.PreviewProps = {
  firstName: "Marie",
  subjectName: "Sönke Peters",
  transitionType: "alumni_request",
  requestedAt: "2026-05-21",
  profileUrl: "https://cockpit.start-berlin.com/admin/people/directory/usr_123",
} as MembershipTransitionApprovalNeededEmailProps;

export default MembershipTransitionApprovalNeededEmail;
