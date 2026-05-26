import { Heading, Text } from "react-email";
import { EmailCta } from "@/emails/components/email-cta";
import { EmailShell } from "@/emails/components/email-shell";

interface ApplicationResumeReminderEmailProps {
  firstName: string;
  applicationUrl: string;
  isReconfirmation: boolean;
}

export const ApplicationResumeReminderEmail = ({
  firstName,
  applicationUrl,
  isReconfirmation,
}: ApplicationResumeReminderEmailProps) => {
  const heading = isReconfirmation
    ? "Finish confirming your membership"
    : "Finish your membership application";
  const preview = isReconfirmation
    ? "Finish confirming your START Berlin membership"
    : "Finish your START Berlin membership application";
  const intro = isReconfirmation
    ? "You started confirming your START Berlin membership a few minutes ago but haven't finished yet."
    : "You started your START Berlin membership application a few minutes ago but haven't finished yet.";
  const buttonLabel = isReconfirmation ? "Confirm membership" : "Continue";

  return (
    <EmailShell
      preview={preview}
      eyebrow="Membership"
      campaign="application-resume-reminder"
    >
      <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
        {heading}
      </Heading>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        Hi {firstName},
      </Text>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        {intro} Your progress is saved in START Cockpit, so you can pick up
        right where you left off.
      </Text>
      <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
        It only takes a few more minutes to finish.
      </Text>
      <EmailCta
        href={applicationUrl}
        label={buttonLabel}
        campaign="application-resume-reminder"
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
};

ApplicationResumeReminderEmail.PreviewProps = {
  firstName: "Sönke",
  applicationUrl: "https://cockpit.start-berlin.com/membership",
  isReconfirmation: false,
} as ApplicationResumeReminderEmailProps;

export default ApplicationResumeReminderEmail;
