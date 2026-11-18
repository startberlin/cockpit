# Jobboard API v1

The canonical executable schema is `src/internal-apps/jobboard/lib/contracts.ts`. Its exact copy in the independent public project is checked by `npm run jobboard:check-contract`. Both sides validate payloads. Unknown private/analytics properties are rejected instead of forwarded.

## Authentication

Every request needs `Authorization: Bearer <key>`. The read, submission and metrics keys are independent, at least 32 characters, and configured only in server environments. No key provides access to member data or editorial mutations. Use TLS outside localhost. Empty, missing, reused across scopes, or invalid credentials fail closed. Do not log authorization headers. To revoke, remove the corresponding key and reload the server configuration.

Staging receives `JOBBOARD_READ_API_KEY`, `JOBBOARD_SUBMIT_API_KEY` and `JOBBOARD_METRICS_API_KEY` from the two repositories' main-only GitHub `staging` environments. Each secret must match across the two services. The trusted deployment workflows pass them to the individual Vercel deployment at runtime. Website V2 sends aggregate events when its dedicated metrics key is valid and distinct from its other service keys. The key is the only switch. To pause collection, remove the metrics key from the website deployment and redeploy.

Internal editing in Cockpit needs no website deployment or public API credentials. For a later public production launch, generate a separate set of three keys and configure them as Production-only secrets in the Cockpit and website Vercel projects. Set Cockpit's `JOBBOARD_PUBLIC_URL=https://www.start-berlin.com/jobs` and `NEXT_PUBLIC_COCKPIT_URL=https://cockpit.start-berlin.com`. Next.js needs the latter at build time and runtime for links to the authenticated inbox. On the website set `COCKPIT_API_URL=https://cockpit.start-berlin.com/api/jobboard/v1` and `PUBLIC_SITE_URL=https://www.start-berlin.com`. Supply the matching website metrics key when collection is approved. Both production workflows build a Production candidate before assigning public domains. PR previews must stay credential-free.

| Method and path | Key | Result |
| --- | --- | --- |
| GET `/api/jobboard/v1/jobs` | Read | `{version:"1", jobs: PublicJob[], nextCursor: string|null}` |
| GET `/api/jobboard/v1/jobs/{id}` | Read | `{version:"1", job: PublicJob}`; never-published roles return not found |
| POST `/api/jobboard/v1/submissions` | Submit | `{version:"1", id, status:"pending_review"}` |
| POST `/api/jobboard/v1/metrics` | Metrics | `{version:"1", accepted: number}` |

List pagination uses opaque cursors and a bounded `limit`. The public client follows cursors. Paused roles return 404 on the public detail endpoint. Details return `status:"closed"` for expired or closed published roles; a consumer must not offer an application or active JobPosting markup for those records. Public reads are not cached across publication/status changes.

`PublicJob` contains `id`, `slug`, `content`, `company`, `status`, `publishedAt`, and `expiresAt`. `content` is the approved `JobContent`; `company` contains only `id`, `name`, `website`, and `description`. Private contacts and review/terms notes are excluded by construction.

Submissions contain a UUID `requestId`, public company fields, one contact, job content and `permissionToPublish:true`. The same request ID must be reused only when retrying the same submission. A conflicting payload with the same ID must fail rather than create or overwrite a record. Neither a requested status nor a publication field is accepted.

Metrics contain `{events:[...]}` with at most 100 events per batch. An event has a UUID `eventId`, ISO `occurredAt`, allowed `type`, nullable `jobId`, `surface`, and `source`. Retry an event with its original ID. Retained IDs prevent a repeated transfer from incrementing aggregates twice. Events more than 24 hours old are rejected; deduplication records outlive the accepted replay window.

Allowed types: `board_request`, `detail_request`, `widget_request`, `apply_redirect`, `share_redirect`. Sources: `direct`, `website`, `widget`, `whatsapp`, `linkedin`, `newsletter`, `unknown`. Surfaces: `standalone`, `widget`. No arbitrary query parameters, user IDs, IP addresses, email addresses or full referrers are accepted.

Errors use `{version:"1", error:{code,message}}`. Invalid JSON or unsupported schema is rejected; bodies and batch sizes are bounded. Missing records, forbidden capabilities, invalid requests and temporary backend failures remain distinguishable. Responses never expose SQL or configuration details. The public UI must show a temporary failure rather than pretend a submission succeeded.

The public application's redirect handlers resolve the approved job by ID and re-check active status. They do not accept arbitrary destination URLs. Metrics transfer runs after the response with bounded retries, so telemetry cannot block applying or sharing.
