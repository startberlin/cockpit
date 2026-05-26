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
    preview="Set up your yearly membership payment"
    eyebrow="Membership payment"
    campaign="mandate-setup-abandonment-reminder"
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      Set up your yearly membership payment
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Your START Berlin membership is active, but your yearly membership payment
      is not set up yet.
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Your START Berlin membership costs{" "}
      <strong style={{ color: "#1C1917" }}>40 EUR per year</strong>. It covers
      the essentials that keep the association running and helps fund internal
      and external events and member benefits throughout the year.
    </Text>
    <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
      No money is taken now. You will be guided through the payment setup in
      START Cockpit, and notified before each yearly payment. It only takes a
      minute.
    </Text>
    <EmailCta
      href={membershipUrl}
      label="Set up payment"
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
