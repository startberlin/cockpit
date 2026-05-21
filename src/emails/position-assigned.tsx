import { Heading, Text } from "react-email";
import { EmailShell } from "@/emails/components/email-shell";

interface PositionAssignedEmailProps {
  firstName: string;
  positionLabel: string;
}

export const PositionAssignedEmail = ({
  firstName,
  positionLabel,
}: PositionAssignedEmailProps) => (
  <EmailShell
    preview={`You've been assigned as ${positionLabel} at START Berlin`}
    eyebrow="Position update"
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      You've been assigned as {positionLabel}
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      You've been assigned as{" "}
      <strong style={{ color: "#1C1917" }}>{positionLabel}</strong> at START
      Berlin e.V. Your access and responsibilities have been updated
      accordingly.
    </Text>
    <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
      If this was unexpected or you have any questions, please reach out to the
      Operations &amp; Digital department at{" "}
      <span style={{ color: "#1C1917" }}>operations@start-berlin.com</span>.
    </Text>
  </EmailShell>
);

PositionAssignedEmail.PreviewProps = {
  firstName: "Marie",
  positionLabel: "President",
} as PositionAssignedEmailProps;

export default PositionAssignedEmail;
