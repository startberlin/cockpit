import {
  CircleCheckIcon,
  CircleDashedIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { env } from "@/env";
import { requireAppAccess } from "@/lib/apps/server";
import { createMetadata } from "@/lib/metadata";
import { ContextHelp } from "../components/context-help";
import { PageHeader } from "../components/page-header";
import { serviceKeyStatus } from "../lib/service-auth";

export const metadata = createMetadata({
  title: "Jobboard settings",
  description: "Integration readiness and publication defaults.",
});
export default async function SettingsPage() {
  await requireAppAccess("jobboard");
  const keys = {
    read: env.JOBBOARD_READ_API_KEY,
    submit: env.JOBBOARD_SUBMIT_API_KEY,
    metrics: env.JOBBOARD_METRICS_API_KEY,
  };
  const integrations = [
    {
      name: "Published jobs",
      status: serviceKeyStatus("read", keys),
      description: "The key the public website uses to request approved jobs.",
    },
    {
      name: "Employer submissions",
      status: serviceKeyStatus("submit", keys),
      description:
        "The key the public website uses to submit an employer's job for review.",
    },
    {
      name: "Public website",
      status: env.JOBBOARD_PUBLIC_URL ? "configured" : "missing",
      description: "The address used for job links and sharing.",
    },
  ];
  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-7">
      <PageHeader title="Settings">
        {env.JOBBOARD_PUBLIC_URL ? (
          <Button variant="outline" asChild>
            <a
              href={env.JOBBOARD_PUBLIC_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open jobboard <ExternalLinkIcon aria-hidden="true" />
            </a>
          </Button>
        ) : null}
      </PageHeader>
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6">
          <div className="flex items-center gap-1">
            <h2 className="text-base font-semibold">Connection settings</h2>
            <ContextHelp label="About connection settings">
              Cockpit checks its local deployment settings. Each service needs a
              different key. Verify the website connection separately.
            </ContextHelp>
          </div>
          <Badge variant="secondary">
            {integrations.filter((item) => item.status === "configured").length}
            /{integrations.length} required settings configured
          </Badge>
        </div>
        <ul className="divide-y px-5 sm:px-6">
          {integrations.map((integration) => (
            <li
              key={integration.name}
              className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
            >
              <div className="flex min-w-0 items-center gap-1">
                <h3 className="text-sm font-medium">{integration.name}</h3>
                <ContextHelp label={`About ${integration.name.toLowerCase()}`}>
                  {integration.description}
                </ContextHelp>
              </div>
              <Badge
                className="shrink-0"
                variant={
                  integration.status === "configured" ? "secondary" : "outline"
                }
              >
                {integration.status === "configured" ? (
                  <CircleCheckIcon aria-hidden="true" />
                ) : (
                  <CircleDashedIcon aria-hidden="true" />
                )}
                {integration.status === "configured"
                  ? "Configured"
                  : integration.status === "invalid"
                    ? "Invalid configuration"
                    : "Missing"}
              </Badge>
            </li>
          ))}
          <li className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 flex-1 basis-56 space-y-1">
              <h3 className="text-sm font-medium">Analytics API (optional)</h3>
              <p className="text-xs text-muted-foreground">
                This key lets Cockpit receive aggregate request counts. The
                public website controls collection separately.
              </p>
            </div>
            <Badge variant="outline" className="shrink-0">
              {
                {
                  configured: "Key configured",
                  invalid: "Invalid key",
                  missing: "No key configured",
                }[serviceKeyStatus("metrics", keys)]
              }
            </Badge>
          </li>
        </ul>
      </section>
      <section className="overflow-hidden rounded-xl border bg-card">
        <h2 className="border-b px-5 py-4 text-base font-semibold sm:px-6">
          Defaults
        </h2>
        <dl className="divide-y px-5 text-sm sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <dt className="flex items-center gap-1 font-medium">
              Listing duration
              <ContextHelp label="About listing duration">
                Publishers set the expiry date and can extend a live listing
                while keeping draft changes private.
              </ContextHelp>
            </dt>
            <dd className="text-muted-foreground">60 days</dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <dt className="flex items-center gap-1 font-medium">
              Employer submissions
              <ContextHelp label="About submission review">
                Accepting a submission creates a draft. Partnerships leads and
                Cockpit admins can review and publish it.
              </ContextHelp>
            </dt>
            <dd className="text-muted-foreground">Review required</dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <dt className="flex items-center gap-1 font-medium">
              Billing
              <ContextHelp label="About billing">
                Record agreements in the company profile. Pricing and payment
                collection are not enabled.
              </ContextHelp>
            </dt>
            <dd className="text-muted-foreground">Manual agreements</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
