import { Heading, Text } from "react-email";
import { EmailShell } from "@/emails/components/email-shell";

interface MembershipAlumniConfirmedEmailProps {
  firstName: string;
  keepInTouch: boolean;
}

export const MembershipAlumniConfirmedEmail = ({
  firstName,
  keepInTouch,
}: MembershipAlumniConfirmedEmailProps) => (
  <EmailShell
    preview="Your START Berlin membership has transitioned to alumni"
    eyebrow="Membership"
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      You're now an alumni
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Your membership in START Berlin e.V. has transitioned to Alumni status.
      Your active membership and associated account have been closed.
    </Text>
    {keepInTouch ? (
      <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
        You chose to stay in the loop — we'll keep you updated on START Berlin
        news and events at this address. Thanks for everything you've
        contributed.
      </Text>
    ) : (
      <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
        Thanks for being part of START Berlin. We wish you all the best.
      </Text>
    )}
  </EmailShell>
);

MembershipAlumniConfirmedEmail.PreviewProps = {
  firstName: "Sönke",
  keepInTouch: true,
} as MembershipAlumniConfirmedEmailProps;

export default MembershipAlumniConfirmedEmail;
