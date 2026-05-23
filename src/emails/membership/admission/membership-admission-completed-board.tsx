import { Heading, Text } from "react-email";
import { EmailDetailBlock } from "@/emails/components/email-detail-block";
import { EmailShell } from "@/emails/components/email-shell";

interface MembershipAdmissionCompletedBoardEmailProps {
  firstName: string;
  subjectName: string;
  legalMembershipId: string;
  admissionDate?: string;
  receivingReason?: string;
}

export const MembershipAdmissionCompletedBoardEmail = ({
  firstName,
  subjectName,
  legalMembershipId,
  admissionDate,
  receivingReason,
}: MembershipAdmissionCompletedBoardEmailProps) => {
  const rows = admissionDate
    ? [
        { label: "Membership ID", value: legalMembershipId },
        { label: "Admission date", value: admissionDate },
      ]
    : [{ label: "Membership ID", value: legalMembershipId }];

  return (
    <EmailShell
      preview={`Admission complete: ${subjectName} is now a member`}
      eyebrow="Admission complete"
      footerAudience="board"
      receivingReason={receivingReason}
    >
      <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
        {subjectName} is now a member
      </Heading>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        Hi {firstName},
      </Text>
      <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
        <strong style={{ color: "#1C1917" }}>{subjectName}</strong> has been
        admitted as a member of START Berlin e.V. All required documents have
        been signed and archived.
      </Text>
      <EmailDetailBlock rows={rows} />
    </EmailShell>
  );
};

MembershipAdmissionCompletedBoardEmail.PreviewProps = {
  firstName: "Marie",
  subjectName: "Sönke Peters",
  legalMembershipId: "lm_abc123",
  admissionDate: "21 May 2026",
} as MembershipAdmissionCompletedBoardEmailProps;

export default MembershipAdmissionCompletedBoardEmail;
