import { Heading, Text } from "react-email";
import { EmailDetailBlock } from "@/emails/components/email-detail-block";
import { EmailShell } from "@/emails/components/email-shell";

interface PasswordResetEmailProps {
  firstName: string;
  companyEmail: string;
  temporaryPassword: string;
}

export const PasswordResetEmail = ({
  firstName,
  companyEmail,
  temporaryPassword,
}: PasswordResetEmailProps) => (
  <EmailShell
    preview="Your START Berlin password has been reset"
    eyebrow="Account security"
    footerAudience="member"
    campaign="password-reset"
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      Your START Berlin password has been reset
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
      Your START Berlin password has been reset by an administrator. Use the
      temporary password below to sign in.
    </Text>
    <EmailDetailBlock
      rows={[
        { label: "Email", value: companyEmail },
        { label: "Temporary password", value: temporaryPassword },
      ]}
    />
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      You will be required to change this password on your next sign-in. Choose
      something personal you haven't used elsewhere.
    </Text>
    <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
      If you did not expect this reset or have any concerns, please contact{" "}
      <a href="mailto:operations@start-berlin.com" style={{ color: "#1C1917" }}>
        operations@start-berlin.com
      </a>{" "}
      immediately.
    </Text>
  </EmailShell>
);

PasswordResetEmail.PreviewProps = {
  firstName: "Sönke",
  companyEmail: "soenke.mueller@start-berlin.com",
  temporaryPassword: "••••••••••••",
} as PasswordResetEmailProps;

export default PasswordResetEmail;
