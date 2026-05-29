import { Heading, Text } from "react-email";
import { EmailShell } from "@/emails/components/email-shell";

interface MembershipAnniversary1YearEmailProps {
  firstName: string;
}

export const MembershipAnniversary1YearEmail = ({
  firstName,
}: MembershipAnniversary1YearEmailProps) => (
  <EmailShell
    preview="1 year at START Berlin"
    eyebrow="Member anniversary"
    campaign="membership-anniversary-1-year"
  >
    <Heading className="mt-0 mb-[16px] p-0 font-bold text-[24px] text-[#1C1917]">
      1 year at START Berlin
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      You've been a member of START Berlin e.V. for 1 year. Thank you for being
      part of our community.
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

MembershipAnniversary1YearEmail.PreviewProps = {
  firstName: "Sönke",
} as MembershipAnniversary1YearEmailProps;

export default MembershipAnniversary1YearEmail;
