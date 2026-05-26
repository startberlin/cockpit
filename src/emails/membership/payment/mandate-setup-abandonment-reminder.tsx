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
    preview="Authorize your direct debit to finish your START Berlin membership setup"
    eyebrow="Membership payment"
    campaign="mandate-setup-abandonment-reminder"
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      Authorize your direct debit
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Your START Berlin membership is active. To finish setting it up, we need
      you to authorize a direct debit so we can collect the{" "}
      <strong style={{ color: "#1C1917" }}>40 EUR yearly membership fee</strong>{" "}
      automatically each year.
    </Text>
    <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
      You won&apos;t be charged anything now — this only authorizes our payment
      provider GoCardless to collect future yearly payments, and we&apos;ll
      notify you before each one. The bank authorization takes less than a
      minute.
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
