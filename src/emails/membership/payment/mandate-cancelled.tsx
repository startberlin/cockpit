import { Heading, Text } from "react-email";
import { EmailCta } from "@/emails/components/email-cta";
import { EmailShell } from "@/emails/components/email-shell";

interface MandateCancelledEmailProps {
  firstName: string;
  membershipUrl: string;
  isReminder?: boolean;
}

export const MandateCancelledEmail = ({
  firstName,
  membershipUrl,
  isReminder,
}: MandateCancelledEmailProps) => (
  <EmailShell
    preview="Action needed: set up your direct debit for START Berlin membership"
    eyebrow="Membership payment"
    campaign="mandate-cancelled"
    isReminder={isReminder}
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      {isReminder && "Reminder: "}Your direct debit needs to be set up again
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Your direct debit authorization for the yearly START Berlin membership
      payment was cancelled. This can happen when your bank deactivates it or
      details change on their end. It is not an issue with your account.
    </Text>
    <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
      Setting it up again only takes a minute. You will not be charged twice or
      outside the regular yearly schedule. Your payment continues at{" "}
      <strong style={{ color: "#1C1917" }}>40 EUR per year</strong>, same as
      before. You will be guided through a short bank authorization step to
      confirm the direct debit.
    </Text>
    <EmailCta
      href={membershipUrl}
      label="Set up direct debit"
      campaign="mandate-cancelled"
      isReminder={isReminder}
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

MandateCancelledEmail.PreviewProps = {
  firstName: "Sönke",
  membershipUrl: "https://cockpit.start-berlin.com/membership",
} as MandateCancelledEmailProps;

export default MandateCancelledEmail;
