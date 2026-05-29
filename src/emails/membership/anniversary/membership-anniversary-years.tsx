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
      Today we're celebrating your {years} year anniversary at START Berlin!
      It's great to have you with us and we're happy you've been part of START
      for all this time.
    </Text>
    <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
      We hope you're happy to be a member and have enjoyed your time with START
      so far. See you at the next event!
    </Text>
  </EmailShell>
);

MembershipAnniversaryYearsEmail.PreviewProps = {
  firstName: "Sönke",
  years: 3,
} as MembershipAnniversaryYearsEmailProps;

export default MembershipAnniversaryYearsEmail;
