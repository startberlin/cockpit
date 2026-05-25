import { Heading, Text } from "react-email";
import { EmailShell } from "@/emails/components/email-shell";

type TransitionType = "alumni_request" | "supporting_alumni_request";

const TRANSITION_LABELS: Record<TransitionType, string> = {
  alumni_request: "alumni",
  supporting_alumni_request: "supporting alumni",
};

interface MembershipTransitionRejectedEmailProps {
  firstName: string;
  transitionType: TransitionType;
}

export const MembershipTransitionRejectedEmail = ({
  firstName,
  transitionType,
}: MembershipTransitionRejectedEmailProps) => {
  const label = TRANSITION_LABELS[transitionType];

  return (
    <EmailShell
      preview="Your transition request was not approved at this time"
      eyebrow="Membership"
      campaign="membership-transition-rejected"
    >
      <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
        Transition request not approved
      </Heading>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        Hi {firstName},
      </Text>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        Your request to become{" "}
        <strong style={{ color: "#1C1917" }}>{label}</strong> of START Berlin
        was not approved at this time.
      </Text>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        Your membership remains active. You're welcome to submit a new request
        when you're ready.
      </Text>
      <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
        If you have questions about this decision, reach out to your department
        head or{" "}
        <a href="mailto:vorstand@start-berlin.com" style={{ color: "#1C1917" }}>
          vorstand@start-berlin.com
        </a>
        .
      </Text>
    </EmailShell>
  );
};

MembershipTransitionRejectedEmail.PreviewProps = {
  firstName: "Sönke",
  transitionType: "alumni_request",
} as MembershipTransitionRejectedEmailProps;

export default MembershipTransitionRejectedEmail;
