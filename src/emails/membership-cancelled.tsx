import { Heading, Text } from "react-email";
import { EmailShell } from "@/emails/components/email-shell";

interface MembershipCancelledEmailProps {
  firstName: string;
  keepInTouch: boolean;
}

export const MembershipCancelledEmail = ({
  firstName,
  keepInTouch,
}: MembershipCancelledEmailProps) => (
  <EmailShell
    preview="Your START Berlin membership has ended"
    eyebrow="Membership"
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      Your membership has ended
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Your membership in START Berlin e.V. has ended. We've closed your account
      and any associated memberships.
    </Text>
    {keepInTouch ? (
      <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
        You chose to stay in touch — we'll keep you in the loop on START Berlin
        events and news at this address.
      </Text>
    ) : (
      <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
        Thanks for being part of START Berlin. We wish you all the best.
      </Text>
    )}
  </EmailShell>
);

MembershipCancelledEmail.PreviewProps = {
  firstName: "Sönke",
  keepInTouch: false,
} as MembershipCancelledEmailProps;

export default MembershipCancelledEmail;
