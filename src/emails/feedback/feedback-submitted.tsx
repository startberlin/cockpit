import { Heading, Hr, Link, Section, Text } from "react-email";
import { EmailShell } from "@/emails/components/email-shell";

const CATEGORY_LABEL = {
  bug: "Something is broken",
  suggestion: "Suggestion",
  other: "Something else",
} as const;

type Category = keyof typeof CATEGORY_LABEL;

interface FeedbackSubmittedProps {
  category: Category;
  description: string;
  submittedBy: { name: string; email: string };
  pageUrl: string | null;
  sessionId: string | null;
  sessionReplayUrl: string | null;
}

export function FeedbackSubmitted({
  category,
  description,
  submittedBy,
  pageUrl,
  sessionId,
  sessionReplayUrl,
}: FeedbackSubmittedProps) {
  const label = CATEGORY_LABEL[category];
  const subjectLine = `${label} from ${submittedBy.name}`;

  return (
    <EmailShell
      preview={subjectLine}
      eyebrow={label}
      campaign="feedback-submitted"
      receivingReason="You're receiving this because you manage feedback for START Cockpit."
    >
      <Heading className="mt-0 mb-2 text-[18px] font-bold text-[#0A0F2C]">
        New Cockpit feedback
      </Heading>

      <Section className="rounded-md border border-solid border-[#E7E5E4] bg-[#FAFAF9] p-4">
        <Text className="m-0 whitespace-pre-wrap text-[14px] leading-[22px] text-[#1C1917]">
          {description}
        </Text>
      </Section>

      <Hr className="my-6 border-[#E7E5E4]" />

      <Text className="my-1 text-[13px] text-[#44403C]">
        <strong>From:</strong> {submittedBy.name} (
        <Link
          href={`mailto:${submittedBy.email}`}
          className="text-[#1C1917] underline"
        >
          {submittedBy.email}
        </Link>
        )
      </Text>
      {pageUrl ? (
        <Text className="my-1 text-[13px] text-[#44403C]">
          <strong>Page:</strong>{" "}
          <Link href={pageUrl} className="text-[#1C1917] underline">
            {pageUrl}
          </Link>
        </Text>
      ) : null}
      {sessionId ? (
        <Text className="my-1 text-[13px] text-[#44403C]">
          <strong>Session ID:</strong> {sessionId}
        </Text>
      ) : null}
      {sessionReplayUrl ? (
        <Text className="my-1 text-[13px] text-[#44403C]">
          <strong>Session recording:</strong>{" "}
          <Link href={sessionReplayUrl} className="text-[#1C1917] underline">
            Watch replay
          </Link>
        </Text>
      ) : null}
    </EmailShell>
  );
}

FeedbackSubmitted.PreviewProps = {
  category: "suggestion",
  description: "Could we make the upcoming community events easier to find?",
  submittedBy: { name: "Ada", email: "ada@example.com" },
  pageUrl: "https://cockpit.start-berlin.com",
  sessionId: null,
  sessionReplayUrl: null,
} satisfies FeedbackSubmittedProps;

export default FeedbackSubmitted;
