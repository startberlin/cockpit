import { Heading, Text } from "react-email";
import { EmailCta } from "@/emails/components/email-cta";
import { EmailDetailBlock } from "@/emails/components/email-detail-block";
import { EmailShell } from "@/emails/components/email-shell";

interface MembershipCancellationAcknowledgementNeededEmailProps {
  firstName: string;
  subjectName: string;
  requestedAt: string;
  profileUrl: string;
}

export const MembershipCancellationAcknowledgementNeededEmail = ({
  firstName,
  subjectName,
  requestedAt,
  profileUrl,
}: MembershipCancellationAcknowledgementNeededEmailProps) => (
  <EmailShell
    preview={`Action required: acknowledge ${subjectName}'s membership cancellation`}
    eyebrow="Membership"
    footerAudience="board"
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      Membership cancellation — acknowledgement required
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      <strong style={{ color: "#1C1917" }}>{subjectName}</strong> has requested
      to cancel their START Berlin membership. Please acknowledge this request
      in START Cockpit so we can process the transition.
    </Text>
    <EmailDetailBlock
      rows={[
        { label: "Member", value: subjectName },
        { label: "Requested on", value: requestedAt },
      ]}
    />
    <EmailCta href={profileUrl} label="Review in START Cockpit" />
  </EmailShell>
);

MembershipCancellationAcknowledgementNeededEmail.PreviewProps = {
  firstName: "Marie",
  subjectName: "Sönke Peters",
  requestedAt: "2026-05-21",
  profileUrl: "https://cockpit.start-berlin.com/admin/people/directory/usr_123",
} as MembershipCancellationAcknowledgementNeededEmailProps;

export default MembershipCancellationAcknowledgementNeededEmail;
