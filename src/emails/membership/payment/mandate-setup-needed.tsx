import { Heading, Text } from "react-email";
import { EmailCta } from "@/emails/components/email-cta";
import { EmailShell } from "@/emails/components/email-shell";

interface MandateSetupNeededEmailProps {
  firstName: string;
  membershipUrl: string;
  isReminder?: boolean;
}

export const MandateSetupNeededEmail = ({
  firstName,
  membershipUrl,
  isReminder,
}: MandateSetupNeededEmailProps) => (
  <EmailShell
    preview="Set up your direct debit for START Berlin membership"
    eyebrow="Membership payment"
    campaign="mandate-setup-needed"
    isReminder={isReminder}
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      {isReminder && "Reminder: "}Set up your direct debit
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Your START Berlin membership is active, but your annual membership payment
      has not been authorized yet. Setting up the direct debit only takes a
      minute and is needed so we can collect your{" "}
      <strong style={{ color: "#1C1917" }}>40 EUR yearly membership fee</strong>{" "}
      automatically.
    </Text>
    <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
      You will be guided through a short bank authorization step.
    </Text>
    <EmailCta
      href={membershipUrl}
      label="Set up direct debit"
      campaign="mandate-setup-needed"
      isReminder={isReminder}
    />
    <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
      If you run into any issues or have questions, reach out to{" "}
      <a href="mailto:operations@start-berlin.com" style={{ color: "#1C1917" }}>
        operations@start-berlin.com
      </a>
      .
    </Text>
  </EmailShell>
);

MandateSetupNeededEmail.PreviewProps = {
  firstName: "Sönke",
  membershipUrl: "https://cockpit.start-berlin.com/membership",
  isReminder: true,
} as MandateSetupNeededEmailProps;

export default MandateSetupNeededEmail;
