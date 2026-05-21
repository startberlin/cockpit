import { Heading, Text } from "react-email";
import { EmailShell } from "@/emails/components/email-shell";

interface MembershipApplicationSubmittedEmailProps {
  firstName: string;
}

export const MembershipApplicationSubmittedEmail = ({
  firstName,
}: MembershipApplicationSubmittedEmailProps) => (
  <EmailShell
    preview="We've received your membership application"
    eyebrow="Membership application"
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      Application received
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      We've received your membership application for START Berlin e.V.
    </Text>
    <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
      A copy of your application documents is attached to this email for your
      records.
    </Text>
  </EmailShell>
);

MembershipApplicationSubmittedEmail.PreviewProps = {
  firstName: "Sönke",
} as MembershipApplicationSubmittedEmailProps;

export default MembershipApplicationSubmittedEmail;
