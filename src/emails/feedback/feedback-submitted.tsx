import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  pixelBasedPreset,
  Section,
  Tailwind,
  Text,
} from "react-email";

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
    <Html>
      <Head />
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body
          className="bg-[#F5F5F4] font-sans"
          style={{ margin: 0, padding: "32px 16px" }}
        >
          <Preview>{subjectLine}</Preview>
          <Container className="mx-auto max-w-[600px] bg-white p-8">
            <Heading className="mt-0 mb-2 text-[18px] font-bold text-[#0A0F2C]">
              New Cockpit feedback
            </Heading>
            <Text className="mt-0 mb-6 text-[12px] uppercase tracking-wide text-[#78716C]">
              {label}
            </Text>

            <Section className="rounded-md border border-[#E7E5E4] bg-[#FAFAF9] p-4">
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
                <Link
                  href={sessionReplayUrl}
                  className="text-[#1C1917] underline"
                >
                  Watch replay
                </Link>
              </Text>
            ) : null}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default FeedbackSubmitted;
