import { Heading, Text } from "react-email";
import { EmailCta } from "@/emails/components/email-cta";
import { EmailShell } from "@/emails/components/email-shell";

interface MandateSetupAbandonmentReminderEmailProps {
  firstName: string;
  membershipUrl: string;
}

export const MandateSetupAbandonmentReminderEmail = ({
  firstName,
  membershipUrl,
}: MandateSetupAbandonmentReminderEmailProps) => (
  <EmailShell
    preview="One last step to activate your START Berlin membership"
    eyebrow="Membership payment"
    campaign="mandate-setup-abandonment-reminder"
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      One last step: set up your direct debit
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Your START Berlin membership is active — congratulations! There&apos;s
      just one item left on your todo list: authorizing the direct debit so we
      can collect your{" "}
      <strong style={{ color: "#1C1917" }}>40 EUR yearly membership fee</strong>
      .
    </Text>
    <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
      It only takes a minute — you&apos;ll be guided through a short bank
      authorization step.
    </Text>
    <EmailCta
      href={membershipUrl}
      label="Set up direct debit"
      campaign="mandate-setup-abandonment-reminder"
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

MandateSetupAbandonmentReminderEmail.PreviewProps = {
  firstName: "Sönke",
  membershipUrl: "https://cockpit.start-berlin.com/membership",
} as MandateSetupAbandonmentReminderEmailProps;

export default MandateSetupAbandonmentReminderEmail;
