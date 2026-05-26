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
  const noun = isReconfirmation ? "reconfirmation" : "application";
  const buttonLabel = isReconfirmation
    ? "Resume reconfirmation"
    : "Resume application";

  return (
    <EmailShell
      preview={`Pick up where you left off — finish your ${noun}`}
      eyebrow={
        isReconfirmation
          ? "Membership reconfirmation"
          : "Membership application"
      }
      campaign="application-resume-reminder"
    >
      <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
        Finish your membership {noun}
      </Heading>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        Hi {firstName},
      </Text>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        You started your START Berlin {noun} a moment ago but haven&apos;t
        submitted it yet. Your progress is saved — just pick up where you left
        off.
      </Text>
      <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
        It only takes a few minutes to finish the remaining steps.
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
