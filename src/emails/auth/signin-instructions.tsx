import { Column, Heading, Row, Text } from "react-email";
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
    campaign="signin-instructions"
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
    <Row className="my-[24px]">
      <Column
        style={{
          border: "1px solid #E7E5E4",
          borderRadius: "4px",
          padding: "16px 20px",
        }}
      >
        <Text
          className="mt-0 mb-[12px] text-[11px] font-bold uppercase text-[#78716C]"
          style={{ letterSpacing: "0.06em" }}
        >
          Next steps
        </Text>
        <Text className="mt-0 mb-[8px] text-[14px] text-[#1C1917] leading-[1.5]">
          ✓ Open your emails at{" "}
          <a href="https://mail.google.com" style={{ color: "#1C1917" }}>
            mail.google.com
          </a>{" "}
          or in the Gmail app
        </Text>
        <Text className="mt-0 mb-0 text-[14px] text-[#1C1917] leading-[1.5]">
          ✓ Find your START Cockpit access instructions in your inbox
        </Text>
      </Column>
    </Row>
    <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
      If you run into any issues signing in, reach out to{" "}
      <a href="mailto:operations@start-berlin.com" style={{ color: "#1C1917" }}>
        operations@start-berlin.com
      </a>
      .
    </Text>
  </EmailShell>
);

SignInInstructionsEmail.PreviewProps = {
  firstName: "Sönke",
  companyEmail: "soenke.mueller@start-berlin.com",
  initialPassword: "••••••••••••",
} as SignInInstructionsEmailProps;

export default SignInInstructionsEmail;
