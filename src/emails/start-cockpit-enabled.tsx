import { Heading, Text } from "react-email";
import type { UserStatus } from "@/db/schema/auth";
import { COCKPIT_URL } from "@/emails/components/cockpit-url";
import { EmailDetailBlock } from "@/emails/components/email-detail-block";
import { EmailShell } from "@/emails/components/email-shell";
import { USER_STATUS_INFO } from "@/lib/user-status";

type StatusContext = Extract<
  UserStatus,
  "member" | "supporting_alumni" | "alumni" | "onboarding"
>;

interface StartCockpitEnabledEmailProps {
  firstName: string;
  statusContext?: StatusContext;
}

export const StartCockpitEnabledEmail = ({
  firstName,
  statusContext,
}: StartCockpitEnabledEmailProps) => {
  const statusLabel = statusContext
    ? USER_STATUS_INFO[statusContext].label
    : null;
  const eyebrow = statusLabel ? `Welcome, ${statusLabel}` : "Your account";

  return (
    <EmailShell preview="Your START Cockpit access is ready" eyebrow={eyebrow}>
      <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
        Your START Cockpit access is ready
      </Heading>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        Hi {firstName},
      </Text>
      <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
        {statusLabel
          ? `You've been added to START Cockpit as ${statusLabel}.`
          : "Your START Cockpit account is ready."}{" "}
        Sign in with your START Berlin Google Account and follow the steps to
        get started.
      </Text>
      <EmailDetailBlock rows={[{ label: "Sign in at", value: COCKPIT_URL }]} />
    </EmailShell>
  );
};

StartCockpitEnabledEmail.PreviewProps = {
  firstName: "Sönke",
  statusContext: "supporting_alumni",
} as StartCockpitEnabledEmailProps;

export default StartCockpitEnabledEmail;
