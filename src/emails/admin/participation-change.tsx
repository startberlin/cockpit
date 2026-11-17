import { Heading, Text } from "react-email";
import { EmailCta } from "@/emails/components/email-cta";
import { EmailShell } from "@/emails/components/email-shell";

interface ParticipationChangeEmailProps {
  recipientName: string;
  memberName?: string;
  paused: boolean;
  effectiveDate: string;
  cockpitUrl: string;
}

export function ParticipationChangeEmail({
  recipientName,
  memberName,
  paused,
  effectiveDate,
  cockpitUrl,
}: ParticipationChangeEmailProps) {
  const state = paused ? "paused" : "resumed";
  const title = memberName
    ? `${memberName}'s participation is ${state}`
    : `Your participation at START Berlin is ${state}`;
  const campaign = `participation-${state}`;

  return (
    <EmailShell
      preview={title}
      eyebrow="Participation update"
      campaign={campaign}
      receivingReason={
        memberName
          ? "You're receiving this as a department lead at START Berlin."
          : undefined
      }
    >
      <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
        {title}
      </Heading>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        Hi {recipientName},
      </Text>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        {memberName
          ? `${memberName}'s participation in your department was ${state} on ${effectiveDate}.`
          : `Your participation at START Berlin was ${state} on ${effectiveDate}.`}
      </Text>
      {!memberName && paused && (
        <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
          Your membership dues continue as usual. You can still use your START
          account, email and Cockpit.
        </Text>
      )}
      <EmailCta
        href={cockpitUrl}
        label={memberName ? "Open people directory" : "View your membership"}
        campaign={campaign}
      />
    </EmailShell>
  );
}

ParticipationChangeEmail.PreviewProps = {
  recipientName: "Alex",
  paused: true,
  effectiveDate: "17 Nov 2026",
  cockpitUrl: "https://cockpit.start-berlin.com/membership",
} satisfies ParticipationChangeEmailProps;

export default ParticipationChangeEmail;
