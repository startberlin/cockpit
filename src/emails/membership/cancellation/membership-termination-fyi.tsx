import { Heading, Text } from "react-email";
import { EmailDetailBlock } from "@/emails/components/email-detail-block";
import { EmailShell } from "@/emails/components/email-shell";

type TerminationContext = "resigned" | "removed_by_board" | "alumni";

const BODY_COPY: Record<TerminationContext, (subjectName: string) => string> = {
  resigned: (name) =>
    `${name} has cancelled their START Berlin e.V. membership. Their member access is being wound down and their associated data will be removed.`,
  removed_by_board: (name) =>
    `${name}'s membership in START Berlin e.V. has been terminated by board resolution. Their member access is being wound down and their associated data will be removed.`,
  alumni: (name) =>
    `${name} has cancelled their START Berlin e.V. membership and transitioned to alumni status. Their active access is being wound down; alumni access (if any) remains in place.`,
};

interface MembershipTerminationFyiEmailProps {
  firstName: string;
  subjectName: string;
  terminatedOn: string;
  context: TerminationContext;
  receivingReason?: string;
}

export const MembershipTerminationFyiEmail = ({
  firstName,
  subjectName,
  terminatedOn,
  context,
  receivingReason,
}: MembershipTerminationFyiEmailProps) => (
  <EmailShell
    preview={`FYI: ${subjectName}'s START Berlin membership has ended`}
    eyebrow="Membership · FYI"
    footerAudience="board"
    receivingReason={receivingReason}
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      Membership terminated for {subjectName}
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      {BODY_COPY[context](subjectName)}
    </Text>
    <EmailDetailBlock
      rows={[
        { label: "Member", value: subjectName },
        { label: "Terminated on", value: terminatedOn },
      ]}
    />
    <Text className="mt-0 mb-0 text-[13px] text-[#A8A29E] leading-[1.65]">
      No action is required. This is an automated notification for your records.
    </Text>
  </EmailShell>
);

MembershipTerminationFyiEmail.PreviewProps = {
  firstName: "Marie",
  subjectName: "Sönke Peters",
  terminatedOn: "2026-05-22",
  context: "resigned",
} as MembershipTerminationFyiEmailProps;

export default MembershipTerminationFyiEmail;
