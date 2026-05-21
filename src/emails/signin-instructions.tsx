import { Heading, Link, Text } from "react-email";
import { EmailCta } from "@/emails/components/email-cta";
import { EmailDetailBlock } from "@/emails/components/email-detail-block";
import { EmailShell } from "@/emails/components/email-shell";

interface SignInInstructionsEmailProps {
  firstName: string;
  companyEmail: string;
  initialPassword: string;
}

export const SignInInstructionsEmail = ({
  firstName,
  companyEmail,
  initialPassword,
}: SignInInstructionsEmailProps) => (
  <EmailShell
    preview="Your START Berlin sign-in details"
    eyebrow="Your START Berlin account"
  >
    <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
      Sign in to your START Berlin account
    </Heading>
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      Hi {firstName},
    </Text>
    <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
      Your START Berlin Google Account is ready. Use the details below to sign
      in.
    </Text>
    <EmailDetailBlock
      rows={[
        { label: "Email", value: companyEmail },
        { label: "Initial password", value: initialPassword },
      ]}
    />
    <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
      You'll be asked to set a new password on first sign-in. Choose something
      personal you haven't used elsewhere.
    </Text>
    <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
      Once you're signed in, open your new inbox at{" "}
      <Link href="https://mail.google.com" className="text-[#1C1917]">
        mail.google.com
      </Link>
      . Your START Cockpit access instructions are waiting there.
    </Text>
  </EmailShell>
);

SignInInstructionsEmail.PreviewProps = {
  firstName: "Sönke",
  companyEmail: "soenke.mueller@start-berlin.com",
  initialPassword: "••••••••••••",
} as SignInInstructionsEmailProps;

export default SignInInstructionsEmail;
