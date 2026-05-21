import { Heading, Text } from "react-email";
import { EmailShell } from "@/emails/components/email-shell";

interface PositionRemovedEmailProps {
  firstName: string;
  positionLabel: string;
}

export const PositionRemovedEmail = ({
  firstName,
  positionLabel,
}: PositionRemovedEmailProps) => (
  <EmailShell
    preview={`Your role as ${positionLabel} at START Berlin has ended`}
    eyebrow="Position update"
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      Your role as {positionLabel} has ended
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Your role as <strong style={{ color: "#1C1917" }}>{positionLabel}</strong>{" "}
      at START Berlin e.V. has ended. Your access for this position has been
      updated accordingly.
    </Text>
    <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
      If you have any questions, please reach out to the Operations &amp;
      Digital department at{" "}
      <a href="mailto:operations@start-berlin.com" style={{ color: "#1C1917" }}>
        operations@start-berlin.com
      </a>
      .
    </Text>
  </EmailShell>
);

PositionRemovedEmail.PreviewProps = {
  firstName: "Marie",
  positionLabel: "President",
} as PositionRemovedEmailProps;

export default PositionRemovedEmail;
