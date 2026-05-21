import { Heading, Text } from "react-email";
import { EmailDetailBlock } from "@/emails/components/email-detail-block";
import { EmailShell } from "@/emails/components/email-shell";

interface MembershipPaymentUpcomingEmailProps {
  firstName: string;
  amountEur: number;
}

export const MembershipPaymentUpcomingEmail = ({
  firstName,
  amountEur,
}: MembershipPaymentUpcomingEmailProps) => {
  const formattedAmount = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amountEur);

  return (
    <EmailShell
      preview={`${formattedAmount} will be collected soon. No action needed.`}
      eyebrow="Membership payment"
    >
      <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
        Your membership payment is coming up
      </Heading>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        Hi {firstName},
      </Text>
      <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
        Your yearly START Berlin membership payment is scheduled and will be
        collected automatically. There's nothing you need to do.
      </Text>
      <EmailDetailBlock rows={[{ label: "Amount", value: formattedAmount }]} />
      <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
        If you have any questions about your membership, visit START Cockpit or
        reach out to{" "}
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

MembershipPaymentUpcomingEmail.PreviewProps = {
  firstName: "Sönke",
  amountEur: 40,
} as MembershipPaymentUpcomingEmailProps;

export default MembershipPaymentUpcomingEmail;
