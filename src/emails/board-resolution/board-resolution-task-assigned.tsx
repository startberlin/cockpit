import { Heading, Text } from "react-email";
import { EmailCta } from "@/emails/components/email-cta";
import { EmailShell } from "@/emails/components/email-shell";

interface BoardResolutionTaskAssignedEmailProps {
  firstName: string;
  subjectName: string;
  resolutionUrl: string;
  isReminder?: boolean;
}

export const BoardResolutionTaskAssignedEmail = ({
  firstName,
  subjectName,
  resolutionUrl,
  isReminder,
}: BoardResolutionTaskAssignedEmailProps) => (
  <EmailShell
    preview={`Action required: vote on ${subjectName}'s membership`}
    eyebrow="Board resolution"
    footerAudience="board"
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      {isReminder && "Reminder: "}Membership vote required
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      <strong style={{ color: "#1C1917" }}>{subjectName}</strong> has applied
      for membership in START Berlin e.V. As a board member, your vote is needed
      to move the application forward.
    </Text>
    <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
      Open the resolution in START Cockpit to view the application details and
      record your vote.
    </Text>
    <EmailCta href={resolutionUrl} label="View resolution" />
  </EmailShell>
);

BoardResolutionTaskAssignedEmail.PreviewProps = {
  firstName: "Marie",
  subjectName: "Sönke Peters",
  resolutionUrl:
    "https://cockpit.start-berlin.com/admin/tasks/vote-admission/res_123",
} as BoardResolutionTaskAssignedEmailProps;

export default BoardResolutionTaskAssignedEmail;
