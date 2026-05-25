import { Heading, Text } from "react-email";
import { EmailShell } from "@/emails/components/email-shell";

interface MembershipSupportingAlumniConfirmedEmailProps {
  firstName: string;
}

export const MembershipSupportingAlumniConfirmedEmail = ({
  firstName,
}: MembershipSupportingAlumniConfirmedEmailProps) => (
  <EmailShell
    preview="You're now a Supporting Alumni of START Berlin"
    eyebrow="Membership"
    campaign="membership-supporting-alumni-confirmed"
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      You're now a Supporting Alumni
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Your transition to Supporting Alumni of START Berlin e.V. is confirmed.
      You'll still be invited to events and community activities, and we're glad
      to keep you in the START Berlin community.
    </Text>
    <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
      Thanks for your continued support.
    </Text>
  </EmailShell>
);

MembershipSupportingAlumniConfirmedEmail.PreviewProps = {
  firstName: "Sönke",
} as MembershipSupportingAlumniConfirmedEmailProps;

export default MembershipSupportingAlumniConfirmedEmail;
