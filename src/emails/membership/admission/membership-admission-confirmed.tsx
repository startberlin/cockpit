import { Heading, Text } from "react-email";
import { EmailCta } from "@/emails/components/email-cta";
import { EmailShell } from "@/emails/components/email-shell";
import { EmailStatusBadge } from "@/emails/components/email-status-badge";

interface MembershipAdmissionConfirmedEmailProps {
  firstName: string;
  includesPaymentCta: boolean;
  membershipUrl: string;
}

export const MembershipAdmissionConfirmedEmail = ({
  firstName,
  includesPaymentCta,
  membershipUrl,
}: MembershipAdmissionConfirmedEmailProps) => {
  const preview = includesPaymentCta
    ? "Finalize your START Berlin membership"
    : "Your START Berlin membership is active";

  return (
    <EmailShell preview={preview} eyebrow="Welcome to START Berlin">
      {includesPaymentCta ? (
        <>
          <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
            Set up your yearly membership payment
          </Heading>
          <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
            Hi {firstName},
          </Text>
          <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
            Your membership in START Berlin e.V. is confirmed. To complete your
            membership, please set up your yearly payment.
          </Text>
          <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
            START Berlin membership is{" "}
            <strong style={{ color: "#1C1917" }}>40 EUR per year</strong>. It
            funds events, operations, and member benefits throughout the year.
          </Text>
          <EmailCta href={membershipUrl} label="Set up membership payment" />
          <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
            If you have any questions, reach out to{" "}
            <a
              href="mailto:people@start-berlin.com"
              style={{ color: "#1C1917" }}
            >
              people@start-berlin.com
            </a>
            .
          </Text>
        </>
      ) : (
        <>
          <Heading className="mt-0 mb-[16px] p-0 font-bold text-[24px] text-[#1C1917]">
            Your membership is active
          </Heading>
          <EmailStatusBadge variant="active" label="Active member" />
          <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
            Hi {firstName},
          </Text>
          <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
            Your membership in START Berlin e.V. is confirmed and active. Thanks
            for being part of START Berlin.
          </Text>
          <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
            If you have any questions, reach out to{" "}
            <a
              href="mailto:people@start-berlin.com"
              style={{ color: "#1C1917" }}
            >
              people@start-berlin.com
            </a>
            .
          </Text>
        </>
      )}
    </EmailShell>
  );
};

MembershipAdmissionConfirmedEmail.PreviewProps = {
  firstName: "Sönke",
  includesPaymentCta: true,
  membershipUrl: "https://cockpit.start-berlin.com/membership",
} as MembershipAdmissionConfirmedEmailProps;

export default MembershipAdmissionConfirmedEmail;
