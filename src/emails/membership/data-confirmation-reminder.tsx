import { Heading, Text } from "react-email";
import { EmailCta } from "@/emails/components/email-cta";
import { EmailShell } from "@/emails/components/email-shell";

interface DataConfirmationReminderEmailProps {
  firstName: string;
  confirmUrl: string;
}

export const DataConfirmationReminderEmail = ({
  firstName,
  confirmUrl,
}: DataConfirmationReminderEmailProps) => (
  <EmailShell
    preview="Please confirm your START Berlin member data is still up to date"
    eyebrow="Member data check"
    campaign="data-confirmation-reminder"
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      Is your member data still up to date?
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      We periodically ask our members to review their contact details (address,
      phone number, personal email) so we always have accurate information on
      file.
    </Text>
    <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
      If everything looks good, just click "Confirm member data" and you're
      done. If anything has changed, update it at the same time.
    </Text>
    <EmailCta
      href={confirmUrl}
      label="Review &amp; confirm member data"
      campaign="data-confirmation-reminder"
    />
    <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
      If you have questions, reach out to{" "}
      <a href="mailto:operations@start-berlin.com" style={{ color: "#1C1917" }}>
        operations@start-berlin.com
      </a>
      .
    </Text>
  </EmailShell>
);

DataConfirmationReminderEmail.PreviewProps = {
  firstName: "Sönke",
  confirmUrl: "https://cockpit.start-berlin.com/membership/settings?confirm=1",
} as DataConfirmationReminderEmailProps;

export default DataConfirmationReminderEmail;
