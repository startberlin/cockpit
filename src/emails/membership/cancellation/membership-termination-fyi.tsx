import { Heading, Text } from "react-email";
import { EmailDetailBlock } from "@/emails/components/email-detail-block";
import { EmailShell } from "@/emails/components/email-shell";

type TerminationContext = "resigned" | "removed_by_board" | "alumni";

const BODY_COPY: Record<TerminationContext, (subjectName: string) => string> = {
  resigned: (name) =>
    `${name} has cancelled their START Berlin e.V. membership. Their account has been closed and their associated data will be removed shortly.`,
  removed_by_board: (name) =>
    `${name}'s membership in START Berlin e.V. has been terminated by board resolution. Their account has been closed and their associated data will be removed shortly.`,
  alumni: (name) =>
    `${name} has cancelled their START Berlin e.V. membership and transitioned to alumni status. Their active access has ended; alumni access (if any) remains in place.`,
};

const BODY_COPY_NO_MEMBERSHIP: Record<
  Exclude<TerminationContext, "alumni">,
  (subjectName: string) => string
> = {
  resigned: (name) =>
    `${name} has been removed from START Berlin. Their account has been closed and their associated data will be removed shortly.`,
  removed_by_board: (name) =>
    `${name} has been removed from START Berlin by board resolution. Their account has been closed and their associated data will be removed shortly.`,
};

interface MembershipTerminationFyiEmailProps {
  firstName: string;
  subjectName: string;
  terminatedOn: string;
  context: TerminationContext;
  receivingReason?: string;
  hadLegalMembership?: boolean;
}

export const MembershipTerminationFyiEmail = ({
  firstName,
  subjectName,
  terminatedOn,
  context,
  receivingReason,
  hadLegalMembership = true,
}: MembershipTerminationFyiEmailProps) => {
  const useNoMembershipCopy = !hadLegalMembership && context !== "alumni";
  const heading = useNoMembershipCopy
    ? `${subjectName} has been removed from START Berlin`
    : `Membership terminated for ${subjectName}`;
  const preview = useNoMembershipCopy
    ? `FYI: ${subjectName} has been removed from START Berlin`
    : `FYI: ${subjectName}'s START Berlin membership has ended`;
  const body = useNoMembershipCopy
    ? BODY_COPY_NO_MEMBERSHIP[context as Exclude<TerminationContext, "alumni">](
        subjectName,
      )
    : BODY_COPY[context](subjectName);

  return (
    <EmailShell
      preview={preview}
      eyebrow="Membership · FYI"
      footerAudience="board"
      receivingReason={receivingReason}
      campaign="membership-termination-fyi"
    >
      <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
        {heading}
      </Heading>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        Hi {firstName},
      </Text>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        {body}
      </Text>
      <EmailDetailBlock
        rows={[
          {
            label: useNoMembershipCopy ? "Person" : "Member",
            value: subjectName,
          },
          {
            label: useNoMembershipCopy ? "Removed on" : "Terminated on",
            value: terminatedOn,
          },
        ]}
      />
      <Text className="mt-0 mb-0 text-[13px] text-[#A8A29E] leading-[1.65]">
        No action is required. This is an automated notification for your
        records.
      </Text>
    </EmailShell>
  );
};

MembershipTerminationFyiEmail.PreviewProps = {
  firstName: "Marie",
  subjectName: "Sönke Peters",
  terminatedOn: "2026-05-22",
  context: "resigned",
  hadLegalMembership: true,
} as MembershipTerminationFyiEmailProps;

export default MembershipTerminationFyiEmail;
