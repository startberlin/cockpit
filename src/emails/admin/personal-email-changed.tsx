import { Heading, Text } from "react-email";
import { EmailShell } from "@/emails/components/email-shell";

interface PersonalEmailChangedEmailProps {
  firstName: string;
  newEmail: string;
  isSecurityNotice: boolean;
}

export const PersonalEmailChangedEmail = ({
  firstName,
  newEmail,
  isSecurityNotice,
}: PersonalEmailChangedEmailProps) => {
  const heading = isSecurityNotice
    ? "Your personal email address has been changed"
    : "Your personal email address has been updated";

  const preview = isSecurityNotice
    ? "Your personal email was changed by an admin — verify this was authorised"
    : `Your personal email has been updated to ${newEmail}`;

  return (
    <EmailShell
      preview={preview}
      eyebrow="Account update"
      footerAudience="member"
      campaign="personal-email-changed"
    >
      <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
        {heading}
      </Heading>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        Hi {firstName},
      </Text>
      {isSecurityNotice ? (
        <>
          <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
            Your personal email address has been changed by an admin to{" "}
            <strong style={{ color: "#1C1917" }}>{newEmail}</strong>.
          </Text>
          <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
            If you did not authorise this change, please contact your
            administrator immediately at{" "}
            <a
              href="mailto:operations@start-berlin.com"
              style={{ color: "#1C1917" }}
            >
              operations@start-berlin.com
            </a>
            .
          </Text>
        </>
      ) : (
        <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
          Your personal email address has been updated to{" "}
          <strong style={{ color: "#1C1917" }}>{newEmail}</strong>. Future
          notifications will be sent to this address.
        </Text>
      )}
    </EmailShell>
  );
};

PersonalEmailChangedEmail.PreviewProps = {
  firstName: "Marie",
  newEmail: "marie.new@example.com",
  isSecurityNotice: false,
} as PersonalEmailChangedEmailProps;

export default PersonalEmailChangedEmail;
