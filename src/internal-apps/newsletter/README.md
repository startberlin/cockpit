# Newsletter

The editorial newsletter CMS for the Growth department. Write in one continuous
document, preview the email alongside it, and prepare it for delivery in Cockpit.

Active Growth members can use the app. All department heads and co-leads also
have access, as do the Legal Board positions (president, vice president and
head of finance) and Cockpit admins. The same permission guards the launcher,
pages and server actions. Inactive accounts remain excluded.

Follows `docs/solutions/conventions/internal-app-convention-2026-08-03.md`.

## How it fits together

```
lib/blocks.ts          the block model — one Zod union, shared by editor,
                       database and renderer
lib/editor-document.ts adapts saved blocks to the continuous Tiptap document
components/document-editor.tsx writing, paste handling and upload orchestration
components/slash-menu.tsx keyboard-accessible block and template commands
components/document-nodes.tsx image and legacy template node views
components/document-export.tsx Markdown, HTML and plain-text export
src/emails/newsletter/ React Email templates that turn blocks into email HTML
lib/render.ts          the single rendering path: preview, test send and
                       broadcast all go through it
components/use-issue-autosave.ts  serial saves, retry and navigation protection
lib/sync-status.ts     on-demand reconciliation of scheduled/sending issues
lib/presence-server.ts  expiring, database-backed editor presence
lib/access.ts          shared permission check for every server action
lib/image-upload-policy.ts  shared upload types, size limit and dimensions
lib/resend.ts          Resend client: throttling, retries and the sandbox guard
lib/analytics.ts       per-broadcast metrics
lib/storage.ts         image uploads (local disk or Vercel Blob)
lib/cockpit-import.ts  turns a Cockpit system group into Resend contacts
```

Email templates live under `src/emails/` rather than in this folder because
`npm run email:dev` only reads that directory.

## Writing and exchanging drafts

Write directly in the document. Type `/` at the start of a paragraph to insert a
heading, image, button or an existing START template. The menu accepts English
and German search terms. Arrow keys select a result; Enter inserts it and Escape
closes the menu. Formatting is available in the toolbar and at a text selection.

The Email details panel contains the subject line and preview text. Below it,
Newsletter body identifies the writing area and its formatting toolbar. The
toolbar stays with the body when scrolling; it does not format the inbox fields.

Paste formatted content directly into the body or choose plain-text pasting in
the footer. Markdown is recognised when the clipboard contains plain Markdown.
There is no separate text-import dialog. The copy menu
exports HTML with supported formatting, or Markdown with templates converted to
ordinary text. It also offers a Markdown download.

Images work through file selection, clipboard pasting, drag and drop, or an
HTTP(S) URL. Image settings include alt text, caption and a click target. New
image uploads finish before the test or schedule dialog can open. The broader
image source policy is scoped to newsletter pages.

The preview shows the exact UTF-8 HTML size beside its zoom level. Decimal KB
uses 1,000 bytes; the tooltip exposes the byte count. Measurement happens in
the same server render used for sending. While new content is being rendered,
the previous size is hidden. Failed renders show an unavailable measurement.
At 100,000 bytes a clipping-risk warning appears. This is a conservative warning,
not a guaranteed Gmail cutoff or an estimate of final delivery size. External
image files do not contribute, but their URLs and HTML markup do. Resend tracking
and recipient substitutions can change the HTML after this measurement.

Existing structured editions keep the same database schema. Opening them does
not write a migration. Optional templates appear inside the document and can be
edited, duplicated, moved, or explicitly converted to native text. Conversion
is undoable. Editor and preview remain mounted across mobile view changes, so
switching views preserves the editing history. The preview scales the full
600px or 375px email instead of changing its line wrapping to fit the panel.

## Two providers, on purpose

Cockpit sends transactional mail over AWS SES (`src/lib/email.ts`). The
newsletter sends marketing mail over Resend, from a separate domain
(`emails.start-berlin.com`). If the newsletter ever collects spam complaints,
login and membership mail keep their own reputation.

The default sender is `START Berlin <newsletter@emails.start-berlin.com>`.
It is defined in `lib/config.ts` and can be overridden per issue in the send
dialog. No sender environment variable is needed. `RESEND_API_KEY` is still
required for Resend access.

## Sandbox mode

`NEWSLETTER_SEND_MODE` defaults to `sandbox`. Every dispatching call —
broadcasts, test sends, contact imports — is intercepted and logged instead of
performed. Reads always go through, so the composer, the contact list and the
analytics all work against the real account while nothing can leave the
machine. Going live is a deliberate environment change.

## Things that surprised us about Resend

Worth knowing before changing anything here:

- **Use the SDK's segment filter.** `contacts.list({ segmentId })` targets
  `/segments/:id/contacts` and paginates the actual members. The old manual
  `/contacts?segment_id=...` request returns the whole contact book. The local
  mirror now refreshes per segment, after all pages have loaded successfully.
- **A broadcast to an empty segment succeeds and reaches nobody.** The account's
  "Newsletter Subscribers" segment was created and never populated, so this is
  not hypothetical. The send path refuses to proceed on an empty segment.
- **Engagement is not on the broadcast object.** `broadcasts.get` has no counts;
  `emails.metrics` has them. The `broadcast` dimension only returns rows when
  combined with an explicit `broadcastId` filter.
- **The rate limit is 10 requests per second, account-wide.** `lib/resend.ts`
  throttles to 8 and retries on 429; do not bypass it.
- **Merge tags only work in broadcasts.** The `/emails` endpoint used for test
  sends does not interpolate `{{{contact.first_name}}}`, so `substituteMergeTags`
  swaps in sample values there.

## Local setup

The composer serializes autosaves and uses the acknowledged `updatedAt` revision
to protect drafts from stale edits in another tab. Conflicts preserve local text
and offer export and reload. Preflight, test sends and scheduling also check the
revision before using content. The composer waits for the latest save before
opening the schedule or test dialog. Scheduled and sent content is read-only; "Edit a
copy" starts a fresh draft. Small screens switch between editor and preview,
while desktop keeps the resizable side-by-side view. The issue list streams
optional metrics independently so they cannot block creating or editing drafts.

Drafts show a warning when another visible editor has the same issue open.
The notice identifies the editor and distinguishes recent changes from an idle
open draft. Your other tabs are identified separately. Presence is refreshed
about every ten seconds and abandoned sessions expire after 45 seconds. Hidden
or closed tabs release their presence; returning to a tab registers a new
session. A failed presence check is shown explicitly. The existing revision
checks continue to protect saves and sends if edits overlap.

The generated migration `0059_little_namora` adds the four newsletter tables,
including `newsletter_issue_editor`, after the current Cockpit migration `0058`.
Migration `0060_polite_dragon_man` adds the dispatch lease. Apply the repository's migrations with
`npm run db:migrate` in each intended environment before using the warning.
Presence writes do not change an issue's `updatedAt` revision or its content.

Newsletter writes supply UTC timestamps explicitly because Drizzle interprets
the existing timestamp-without-time-zone columns as UTC. Relying on database
`now()` would shift newly created rows when the database session uses a local
timezone. Scheduled and sent timestamps already use `timestamptz`.

```bash
npm run db:migrate
npm run newsletter:seed     # a Growth user and one issue using every block
npm run dev                 # http://localhost:3000/newsletter
npm run email:dev           # template previews on :3001
```

`.env.local` needs `RESEND_API_KEY` to see real contacts and analytics.
Composing and previewing work without it; the send preflight requires it.

Images default to the `local` storage driver, which writes to `.uploads/` and
serves them back through a route handler. Vercel Blob's client-upload flow
cannot complete on a laptop — its `onUploadCompleted` callback is an inbound
webhook — so uploads go through a server-side `put()` in both drivers. Prepared files are
limited to 4 MiB to leave room for multipart metadata below Vercel's 4.5 MB
request limit. Selecting `blob` without `BLOB_READ_WRITE_TOKEN` fails explicitly
instead of falling back to local disk. All template and native image uploads
share the composer's pending-upload guard.

## Deliberately not built

- No approval workflow. The lifecycle is `draft → scheduled → sent`.
- No public archive or signup page. Unsubscribe and topic preferences are
  handled by Resend's own preference centre, which the footer links to.
- No webhooks. Everything reads on demand, which is also why the whole app is
  testable on localhost without a tunnel.

## Verification and production preparation

See [the 10 October 2026 release review](../../../docs/newsletter/RELEASE-REVIEW-2026-10-10.md)
for the current branch base, real delivery evidence and remaining release gates.

A sending claim without a recorded Resend broadcast expires after 15 minutes.
Opening the issue or its index then marks it failed, retains the content, and
allows an editable copy. The provider draft is created without dispatching it;
dispatch only starts after its ID is recorded. A recorded broadcast is never
released on the basis of elapsed time alone. Uncertain accepted sends continue
through provider status reconciliation.

The existing Cockpit pipeline already applies repository migrations before it
assigns the staging domain or promotes the production deployment. The newsletter
adds no Inngest function or automatic dispatch job. Keep preview dispatch in
sandbox unless an isolated QA segment is selected for an authorised test. Verify
newsletter pages after migrations as well as the existing generic health check.
