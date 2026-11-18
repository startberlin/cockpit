import { Button, Heading, Text } from "react-email";
import { COCKPIT_URL } from "@/emails/components/cockpit-url";
import { EmailShell } from "@/emails/components/email-shell";

export const JOBBOARD_SUBMISSION_EMAIL_SUBJECT =
  "New START Jobboard submission";

interface SubmissionReceivedEmailProps {
  submissionId: string;
  companyName: string;
  jobTitle: string;
}

function displayLabel(label: string) {
  // Mail readers auto-link hostnames even in plain text. Keep submitted names
  // readable without inviting recipients to follow links supplied by employers.
  return label
    .trim()
    .replace(/\s+/gu, " ")
    .replace(
      /(?:[a-z][a-z0-9+.-]*:\/\/|mailto:|tel:)[^\s<>"']+/giu,
      "[link omitted]",
    )
    .replace(/(?:[\p{L}\p{N}-]+\.)+[\p{L}]{2,}(?![\p{L}\p{N}-])/gu, (host) =>
      host.replaceAll(".", "[.]"),
    );
}

export function JobboardSubmissionReceivedEmail({
  submissionId,
  companyName,
  jobTitle,
}: SubmissionReceivedEmailProps) {
  const origin = new URL(COCKPIT_URL);
  const localPreview = ["localhost", "127.0.0.1", "[::1]"].includes(
    origin.hostname,
  );
  if (
    origin.username ||
    origin.password ||
    (origin.protocol !== "https:" &&
      !(localPreview && origin.protocol === "http:"))
  ) {
    throw new Error(
      "A secure Cockpit origin is required for notification emails.",
    );
  }
  if (!/^jbs_[a-zA-Z0-9_-]+$/.test(submissionId)) {
    throw new Error("Invalid Jobboard submission ID.");
  }
  const notificationUrl = new URL(
    `/notifications/jobboard/${submissionId}`,
    origin,
  ).href;

  return (
    <EmailShell
      preview="A new role is ready for review in START Cockpit."
      eyebrow="START Cockpit"
      campaign="jobboard-submission"
      receivingReason="You receive Jobboard notifications as a department lead or a member of the Legal Board."
      showFooterLinks={false}
    >
      <Heading
        as="h1"
        className="mt-0 mb-[20px] text-[24px] font-bold text-[#1C1917]"
      >
        New Jobboard submission
      </Heading>
      <Text
        className="mt-0 mb-[24px] text-[16px] leading-[24px] text-[#44403C]"
        style={{ overflowWrap: "anywhere" }}
      >
        {displayLabel(companyName)} submitted the role "{displayLabel(jobTitle)}
        " for review.
      </Text>
      <Button
        href={notificationUrl}
        className="box-border bg-[#1C1917] px-[18px] py-[12px] text-[14px] font-bold text-white no-underline"
      >
        View submission in Cockpit
      </Button>
    </EmailShell>
  );
}

JobboardSubmissionReceivedEmail.PreviewProps = {
  submissionId: "jbs_ZuRCyH4xW7qGkXaP",
  companyName: "Example Studio",
  jobTitle: "Software Engineer",
} satisfies SubmissionReceivedEmailProps;

export default JobboardSubmissionReceivedEmail;
