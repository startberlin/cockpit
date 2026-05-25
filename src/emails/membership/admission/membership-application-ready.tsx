import { Heading, Text } from "react-email";
import { EmailCta } from "@/emails/components/email-cta";
import { EmailShell } from "@/emails/components/email-shell";

interface MembershipApplicationReadyEmailProps {
  firstName: string;
  applicationUrl: string;
  isReminder?: boolean;
}

export const MembershipApplicationReadyEmail = ({
  firstName,
  applicationUrl,
  isReminder,
}: MembershipApplicationReadyEmailProps) => (
  <EmailShell
    preview="Complete your membership application"
    eyebrow="Membership application"
    campaign="membership-application-ready"
    isReminder={isReminder}
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      {isReminder && "Reminder: "}Complete your membership application
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      You have been invited to join START Berlin e.V. Fill in your details and
      sign your membership application in START Cockpit.
    </Text>
    <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
      Once you submit the application, your membership will be officially
      confirmed.
    </Text>
    <EmailCta
      href={applicationUrl}
      label="Complete application"
      campaign="membership-application-ready"
      isReminder={isReminder}
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

MembershipApplicationReadyEmail.PreviewProps = {
  firstName: "Sönke",
  applicationUrl: "https://cockpit.start-berlin.com/membership",
  isReminder: true,
} as MembershipApplicationReadyEmailProps;

export default MembershipApplicationReadyEmail;
