import { Check, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { env } from "@/env";
import { createMetadata } from "@/lib/metadata";
import { PageContainer, PageHeader } from "../components/page-container";
import { SandboxBanner } from "../components/sandbox-banner";
import { DEFAULT_NEWSLETTER_FROM } from "../lib/config";
import { parseError } from "../lib/error";
import {
  getDomainTracking,
  isResendConfigured,
  listSegments,
  listTopics,
  sendMode,
} from "../lib/resend";

export const metadata = createMetadata({
  title: "Newsletter settings",
  description: "How this app is wired up.",
});

/**
 * A read-only view of the app's configuration.
 *
 * Uses app defaults and deployment configuration rather than a settings table.
 * A form that appeared to change them while the running process kept its own
 * values would be worse than no form at all.
 */
export default async function SettingsPage() {
  const mode = sendMode();
  const configured = isResendConfigured();

  let domains: Awaited<ReturnType<typeof getDomainTracking>> = [];
  let segments: { id: string; name: string }[] = [];
  let topics: { id: string; name: string }[] = [];
  const errors: string[] = [];
  let domainError = false;

  if (configured) {
    const [d, s, t] = await Promise.allSettled([
      getDomainTracking(),
      listSegments(),
      listTopics(),
    ]);
    if (d.status === "fulfilled") domains = d.value;
    else {
      domainError = true;
      errors.push(`Domains: ${parseError(d.reason)}`);
    }
    if (s.status === "fulfilled") segments = s.value;
    else errors.push(`Segments: ${parseError(s.reason)}`);
    if (t.status === "fulfilled") topics = t.value;
    else errors.push(`Topics: ${parseError(t.reason)}`);
  }

  const segmentName =
    segments.find((s) => s.id === env.RESEND_NEWSLETTER_SEGMENT_ID)?.name ??
    null;
  const topicName =
    topics.find((t) => t.id === env.RESEND_NEWSLETTER_TOPIC_ID)?.name ?? null;

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Read-only overview of newsletter delivery and connected services."
      />

      <SandboxBanner mode={mode} />

      {errors.length ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Some settings are unavailable</AlertTitle>
          <AlertDescription>{errors.join(" ")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 *:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>Sending</CardTitle>
            <CardDescription>Where issues go and who from.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Row label="Mode">
              <Badge variant={mode === "live" ? "default" : "secondary"}>
                {mode}
              </Badge>
            </Row>
            <Row label="Default sender">{DEFAULT_NEWSLETTER_FROM}</Row>
            <Row label="Segment">
              {segmentName ?? env.RESEND_NEWSLETTER_SEGMENT_ID ?? "not set"}
            </Row>
            <Row label="Topic">
              {topicName ?? env.RESEND_NEWSLETTER_TOPIC_ID ?? "not set"}
            </Row>
            <Row label="API key">
              <Flag on={configured} onLabel="set" offLabel="missing" />
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Domains</CardTitle>
            <CardDescription>
              Tracking is configured per domain in Resend, not here.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {domains.length === 0 ? (
              <p className="text-muted-foreground">
                {domainError
                  ? "Domains could not be loaded."
                  : configured
                    ? "No domains found."
                    : "Resend is not configured."}
              </p>
            ) : (
              domains.map((domain) => (
                <div key={domain.name} className="flex flex-col gap-1.5">
                  {domain.trackingHost &&
                  domain.trackingStatus !== "verified" ? (
                    <p className="break-words text-amber-700">
                      Tracking DNS is not verified for {domain.trackingHost}.
                      Complete the DNS setup in Resend before relying on open or
                      click tracking.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="break-all font-medium">{domain.name}</span>
                    <Badge
                      variant={
                        domain.status === "verified" ? "secondary" : "outline"
                      }
                    >
                      {domain.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Flag
                        on={domain.openTracking}
                        onLabel="open tracking"
                        offLabel="open tracking"
                      />
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Flag
                        on={domain.clickTracking}
                        onLabel="click tracking"
                        offLabel="click tracking"
                      />
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right [overflow-wrap:anywhere]">
        {children}
      </span>
    </div>
  );
}

function Flag({
  on,
  onLabel,
  offLabel,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {on ? (
        <Check className="size-3.5 text-[color:var(--success)]" />
      ) : (
        <X className="size-3.5 text-muted-foreground" />
      )}
      {on ? onLabel : offLabel}
      {onLabel === offLabel ? (
        <span className="sr-only">{on ? " enabled" : " disabled"}</span>
      ) : null}
    </span>
  );
}
