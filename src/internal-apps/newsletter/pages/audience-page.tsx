import { AlertTriangle } from "lucide-react";
import { createLoader, parseAsInteger, parseAsString } from "nuqs/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { env } from "@/env";
import { createMetadata } from "@/lib/metadata";
import { AudienceActions } from "../components/audience-actions";
import { ContactsTable } from "../components/contacts-table";
import { PageContainer, PageHeader } from "../components/page-container";
import {
  getContactStats,
  getSegmentMemberCounts,
  listContacts,
} from "../db/queries";
import { parseError } from "../lib/error";
import {
  isResendConfigured,
  listSegments,
  listTopics,
  sendMode,
} from "../lib/resend";

export const metadata = createMetadata({
  title: "Audience",
  description: "Contacts, segments and topics.",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});
const loadSearchParams = createLoader({
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(""),
});

export default async function AudiencePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page, q } = await loadSearchParams(searchParams);
  const remoteData = isResendConfigured()
    ? Promise.allSettled([listSegments(), listTopics()])
    : null;

  const [stats, contacts, segmentCounts] = await Promise.all([
    getContactStats(),
    listContacts({ page, search: q }),
    getSegmentMemberCounts(),
  ]);

  let segments: { id: string; name: string }[] = [];
  let topics: Awaited<ReturnType<typeof listTopics>> = [];
  let segmentError: string | null = null;
  let topicError: string | null = null;

  if (remoteData) {
    const [segmentResult, topicResult] = await remoteData;
    if (segmentResult.status === "fulfilled") segments = segmentResult.value;
    else segmentError = parseError(segmentResult.reason);
    if (topicResult.status === "fulfilled") topics = topicResult.value;
    else topicError = parseError(topicResult.reason);
  } else {
    segmentError = topicError = "Resend is not configured.";
  }

  const defaultSegmentId = env.RESEND_NEWSLETTER_SEGMENT_ID ?? null;
  const emptyConfiguredSegment =
    defaultSegmentId && (segmentCounts.get(defaultSegmentId) ?? 0) === 0;

  return (
    <PageContainer>
      <PageHeader
        title="Audience"
        action={
          <AudienceActions
            defaultSegmentId={defaultSegmentId}
            contactCount={stats.total}
            mode={sendMode()}
          />
        }
      />

      {emptyConfiguredSegment && stats.total > 0 ? (
        <Alert className="mb-6">
          <AlertTriangle />
          <AlertTitle className="line-clamp-none">
            No subscribed contacts in the default segment
          </AlertTitle>
          <AlertDescription>
            Run "Sync from Resend" to check for recent audience changes.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 pb-6 sm:grid-cols-4 *:data-[slot=card]:shadow-xs">
        <Card>
          <CardHeader>
            <CardDescription>Contacts</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {stats.total}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Globally unsubscribed</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {stats.unsubscribed}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Segments</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {segmentError ? "-" : segments.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Last sync</CardDescription>
            <CardTitle className="text-sm font-semibold">
              {stats.lastSyncedAt
                ? dateTimeFormat.format(stats.lastSyncedAt)
                : "Never"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {segmentError || topicError ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Some audience details are unavailable</AlertTitle>
          <AlertDescription>
            {[
              segmentError && `Segments: ${segmentError}`,
              topicError && `Topics: ${topicError}`,
            ]
              .filter(Boolean)
              .join(" ")}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 pb-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Segments</CardTitle>
            <CardDescription>
              Internal grouping. Broadcasts are addressed to one of these.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {!segments.length ? (
              <p className="text-sm text-muted-foreground">
                {segmentError
                  ? "Segments could not be loaded."
                  : "No segments configured in Resend."}
              </p>
            ) : null}
            {segments.map((segment) => (
              <div
                key={segment.id}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  {segment.name}
                  {segment.id === defaultSegmentId ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      default
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {segmentCounts.get(segment.id) ?? 0}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Topics</CardTitle>
            <CardDescription>
              Email preferences managed in Resend.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {!topics.length ? (
              <p className="text-sm text-muted-foreground">
                {topicError
                  ? "Topics could not be loaded."
                  : "No topics configured in Resend."}
              </p>
            ) : null}
            {topics.map((topic) => (
              <div
                key={topic.id}
                className="flex justify-between gap-2 text-sm"
              >
                <span>{topic.name}</span>
                <span className="text-muted-foreground">
                  {topic.default_subscription === "opt_in"
                    ? "Opt-in by default"
                    : "Opt-out by default"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <ContactsTable
        rows={contacts.rows}
        topics={topics.map(({ id, name }) => ({ id, name }))}
        total={contacts.total}
        pageCount={contacts.pageCount}
        currentPage={contacts.currentPage}
      />
    </PageContainer>
  );
}
