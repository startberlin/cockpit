import { Heading, Text } from "react-email";
import { EmailShell } from "@/emails/components/email-shell";

interface MembershipAnniversaryYearsEmailProps {
  firstName: string;
  years: number;
}

export const MembershipAnniversaryYearsEmail = ({
  firstName,
  years,
}: MembershipAnniversaryYearsEmailProps) => (
  <EmailShell
    preview={`${years} years at START Berlin`}
    eyebrow="Member anniversary"
    campaign="membership-anniversary-years"
  >
    <Heading className="mt-0 mb-[16px] p-0 font-bold text-[24px] text-[#1C1917]">
      {years} years at START Berlin
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      You've been a member of START Berlin e.V. for {years} years. Thank you for
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

MembershipAnniversaryYearsEmail.PreviewProps = {
  firstName: "Sönke",
  years: 3,
} as MembershipAnniversaryYearsEmailProps;

export default MembershipAnniversaryYearsEmail;
