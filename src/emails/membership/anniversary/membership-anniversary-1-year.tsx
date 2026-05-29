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
      Today we're celebrating your 1 year anniversary at START Berlin! It's
      great to have you with us and we're happy you've decided to join one year
      ago.
    </Text>
    <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
      We hope you're happy to be a member and have enjoyed your time with START
      so far. See you at the next event!
    </Text>
  </EmailShell>
);

MembershipAnniversary1YearEmail.PreviewProps = {
  firstName: "Sönke",
} as MembershipAnniversary1YearEmailProps;

export default MembershipAnniversary1YearEmail;
