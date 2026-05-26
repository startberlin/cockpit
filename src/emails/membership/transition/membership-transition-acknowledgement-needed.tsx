import { Heading, Text } from "react-email";
import { EmailCta } from "@/emails/components/email-cta";
import { EmailDetailBlock } from "@/emails/components/email-detail-block";
import { EmailShell } from "@/emails/components/email-shell";

interface MembershipTransitionAcknowledgementNeededEmailProps {
  firstName: string;
  subjectName: string;
  requestedAt: string;
  profileUrl: string;
  receivingReason?: string;
  isReminder?: boolean;
}

export const MembershipTransitionAcknowledgementNeededEmail = ({
  firstName,
  subjectName,
  requestedAt,
  profileUrl,
  receivingReason,
  isReminder,
}: MembershipTransitionAcknowledgementNeededEmailProps) => (
  <EmailShell
    preview={`Action required: acknowledge ${subjectName}'s transition to alumni`}
    eyebrow="Membership"
    footerAudience="board"
    receivingReason={receivingReason}
    campaign="membership-transition-acknowledgement-needed"
    isReminder={isReminder}
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      {isReminder && "Reminder: "}
      {subjectName} wants to transition from Supporting Alumni to alumni status
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      <strong style={{ color: "#1C1917" }}>{subjectName}</strong> currently has
      Supporting Alumni status at START Berlin and has requested to move to
      alumni status. No approval is required — the request will auto-confirm 7
      days after submission. You can acknowledge it now to process it
      immediately.
    </Text>
    <EmailDetailBlock
      rows={[
        { label: "Member", value: subjectName },
        { label: "Requested on", value: requestedAt },
      ]}
    />
    <EmailCta
      href={profileUrl}
      label="Review in START Cockpit"
      campaign="membership-transition-acknowledgement-needed"
      isReminder={isReminder}
    />
  </EmailShell>
);

MembershipTransitionAcknowledgementNeededEmail.PreviewProps = {
  firstName: "Marie",
  subjectName: "Sönke Peters",
  requestedAt: "2026-05-21",
  profileUrl: "https://cockpit.start-berlin.com/admin/people/usr_123",
} as MembershipTransitionAcknowledgementNeededEmailProps;

export default MembershipTransitionAcknowledgementNeededEmail;
