import { Heading, Text } from "react-email";
import { EmailCta } from "@/emails/components/email-cta";
import { EmailShell } from "@/emails/components/email-shell";

interface ReconfirmationAbandonmentReminderEmailProps {
  firstName: string;
  reconfirmationUrl: string;
}

export const ReconfirmationAbandonmentReminderEmail = ({
  firstName,
  reconfirmationUrl,
}: ReconfirmationAbandonmentReminderEmailProps) => (
  <EmailShell
    preview="Confirm your START Berlin membership"
    eyebrow="Membership"
    campaign="reconfirmation-abandonment-reminder"
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      Confirm your membership
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      We still need a few details to confirm your START Berlin membership. It
      only takes a few minutes in START Cockpit.
    </Text>
    <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
      Once you confirm your details, your membership setup is complete.
    </Text>
    <EmailCta
      href={reconfirmationUrl}
      label="Confirm membership"
      campaign="reconfirmation-abandonment-reminder"
    />
    <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
      If you have any questions, reach out to{" "}
      <a href="mailto:people@start-berlin.com" style={{ color: "#1C1917" }}>
        people@start-berlin.com
      </a>
      .
    </Text>
  </EmailShell>
);

ReconfirmationAbandonmentReminderEmail.PreviewProps = {
  firstName: "Sönke",
  reconfirmationUrl: "https://cockpit.start-berlin.com/membership",
} as ReconfirmationAbandonmentReminderEmailProps;

export default ReconfirmationAbandonmentReminderEmail;
