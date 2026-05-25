import { Heading, Text } from "react-email";
import { EmailShell } from "@/emails/components/email-shell";
import { EmailStatusBadge } from "@/emails/components/email-status-badge";

interface MembershipAdmissionConfirmedEmailProps {
  firstName: string;
}

export const MembershipAdmissionConfirmedEmail = ({
  firstName,
}: MembershipAdmissionConfirmedEmailProps) => (
  <EmailShell
    preview="Your START Berlin membership is active"
    eyebrow="Welcome to START Berlin"
    campaign="membership-admission-confirmed"
  >
    <Heading className="mt-0 mb-[16px] p-0 font-bold text-[24px] text-[#1C1917]">
      Your membership is active
    </Heading>
    <EmailStatusBadge variant="active" label="Active member" />
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Your membership in START Berlin e.V. is confirmed and active. Thanks for
      being part of START Berlin.
    </Text>
    <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
      If you have any questions, reach out to{" "}
      <a href="mailto:people@start-berlin.com" style={{ color: "#1C1917" }}>
        people@start-berlin.com
      </a>
      .
    </Text>
  </EmailShell>
);

MembershipAdmissionConfirmedEmail.PreviewProps = {
  firstName: "Sönke",
} as MembershipAdmissionConfirmedEmailProps;

export default MembershipAdmissionConfirmedEmail;
