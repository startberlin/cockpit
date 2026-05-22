import { Heading, Text } from "react-email";
import type { UserStatus } from "@/db/schema/auth";
import { COCKPIT_URL } from "@/emails/components/cockpit-url";
import { EmailCta } from "@/emails/components/email-cta";
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
  const isOnboarding = statusContext === "onboarding";
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
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        START Cockpit is START Berlin's {isOnboarding ? "" : "new "}membership
        platform: The place where you manage your membership and see everyone
        who is part of START Berlin.
      </Text>
      <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
        {statusLabel ? (
          <>
            Your account has been set up as{" "}
            <strong style={{ color: "#1C1917" }}>{statusLabel}</strong>.{" "}
          </>
        ) : (
          <>Your account is ready. </>
        )}
        Sign in with your START Berlin Google Account and complete your member
        profile to get started.
      </Text>
      <EmailCta href={COCKPIT_URL} label="Sign in to START Cockpit" />
      <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
        If you have any questions, reach out to{" "}
        <a
          href="mailto:operations@start-berlin.com"
          style={{ color: "#1C1917" }}
        >
          operations@start-berlin.com
        </a>
        .
      </Text>
    </EmailShell>
  );
};

StartCockpitEnabledEmail.PreviewProps = {
  firstName: "Sönke",
  statusContext: "supporting_alumni",
} as StartCockpitEnabledEmailProps;

export default StartCockpitEnabledEmail;
