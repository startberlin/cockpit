import { Heading, Text } from "react-email";
import { EmailShell } from "@/emails/components/email-shell";

interface MembershipAnniversary6MonthsEmailProps {
  firstName: string;
}

export const MembershipAnniversary6MonthsEmail = ({
  firstName,
}: MembershipAnniversary6MonthsEmailProps) => (
  <EmailShell
    preview="6 months at START Berlin"
    eyebrow="Member anniversary"
    campaign="membership-anniversary-6-months"
  >
    <Heading className="mt-0 mb-[16px] p-0 font-bold text-[24px] text-[#1C1917]">
      6 months at START Berlin
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      You've been a member of START Berlin e.V. for 6 months. Thank you for
      being part of our community.
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

MembershipAnniversary6MonthsEmail.PreviewProps = {
  firstName: "Sönke",
} as MembershipAnniversary6MonthsEmailProps;

export default MembershipAnniversary6MonthsEmail;
