import "dotenv/config";
import { eq } from "drizzle-orm";
import db from "@/db";
import { user } from "@/db/schema/auth";
import { newsletterIssue } from "@/internal-apps/newsletter/db/schema";
import {
  SAMPLE_PREVIEW_TEXT,
  SAMPLE_SUBJECT,
  sampleBlocks,
} from "@/internal-apps/newsletter/lib/sample-issue";
import { newId } from "@/lib/id";

/**
 * Puts the local database into a state where the newsletter app is worth
 * looking at: a fully onboarded Growth user to sign in as, and one draft issue
 * that exercises every block type.
 *
 * Idempotent — running it twice updates the same rows rather than piling up
 * duplicates.
 *
 * Usage: npm run newsletter:seed -- [email]
 */

const email = (
  process.argv[2] ?? "jannik.schaefer@start-berlin.com"
).toLowerCase();
const baseUrl = process.env.NEXT_PUBLIC_COCKPIT_URL ?? "http://localhost:3000";
const SEED_ISSUE_NAME = "October 2026 (sample)";

async function main() {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname) ||
    process.env.NODE_ENV === "production" ||
    process.env.NEWSLETTER_SEND_MODE === "live"
  ) {
    throw new Error(
      "Newsletter samples require a local database and sandbox mode.",
    );
  }

  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (!existing) {
    console.error(
      `No user with email ${email}. Run: npm run admin:bootstrap -- ${email} First Last`,
    );
    process.exit(1);
  }

  // The apps route group redirects anyone whose onboarding is incomplete, so a
  // freshly bootstrapped admin cannot reach the app until these are filled in.
  await db
    .update(user)
    .set({
      personalEmail: email,
      phone: "+4915112345678",
      birthDate: "1998-01-01",
      eventEmailPreference: "start_email",
      department: "growth",
      status: "member",
    })
    .where(eq(user.id, existing.id));

  const [seeded] = await db
    .select({ id: newsletterIssue.id })
    .from(newsletterIssue)
    .where(eq(newsletterIssue.name, SEED_ISSUE_NAME))
    .limit(1);

  // Reset the whole row, not just the content: re-running the seed after
  // experimenting with a send should hand back a clean draft rather than a
  // sample issue stuck in "canceled".
  const now = new Date();
  const values = {
    name: SEED_ISSUE_NAME,
    subject: SAMPLE_SUBJECT,
    previewText: SAMPLE_PREVIEW_TEXT,
    blocks: sampleBlocks(baseUrl),
    createdBy: existing.id,
    status: "draft" as const,
    fromAddress: null,
    replyTo: null,
    segmentId: process.env.RESEND_NEWSLETTER_SEGMENT_ID || null,
    topicId: null,
    scheduledAt: null,
    sentAt: null,
    resendBroadcastId: null,
    sendMode: null,
    dispatchStartedAt: null,
    lastError: null,
    updatedAt: now,
  };

  if (seeded) {
    await db
      .update(newsletterIssue)
      .set(values)
      .where(eq(newsletterIssue.id, seeded.id));
    console.log(`Updated sample issue ${seeded.id}`);
  } else {
    const id = newId("newsletterIssue");
    await db.insert(newsletterIssue).values({ id, ...values, createdAt: now });
    console.log(`Created sample issue ${id}`);
  }

  // Sample lifecycle states never reference a real provider broadcast.
  const extras = [
    {
      name: "September 2026 (sample)",
      subject: "Summer recap, two new partners, and who is hiring",
      previewText: "Plus the three startups that came out of the last batch.",
      status: "scheduled" as const,
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      sentAt: null,
      resendBroadcastId: `sandbox_${newId("newsletterIssue")}`,
      sendMode: "sandbox" as const,
    },
    {
      name: "Applications Batch #10 (sample)",
      subject: "Applications for Batch #10 are open",
      previewText: "Two weeks to apply. Here is what we look for.",
      status: "sent" as const,
      scheduledAt: null,
      sentAt: new Date("2026-04-14T10:45:39Z"),
      resendBroadcastId: `sandbox_${newId("newsletterIssue")}`,
      sendMode: "sandbox" as const,
    },
  ];

  for (const extra of extras) {
    const [found] = await db
      .select({ id: newsletterIssue.id })
      .from(newsletterIssue)
      .where(eq(newsletterIssue.name, extra.name))
      .limit(1);

    const row = {
      ...extra,
      blocks: sampleBlocks(baseUrl).slice(0, 6),
      createdBy: existing.id,
      lastError: null,
      dispatchStartedAt: null,
      updatedAt: now,
    };

    if (found) {
      await db
        .update(newsletterIssue)
        .set(row)
        .where(eq(newsletterIssue.id, found.id));
    } else {
      await db
        .insert(newsletterIssue)
        .values({ id: newId("newsletterIssue"), ...row, createdAt: now });
    }
    console.log(`Seeded "${extra.name}" (${extra.status})`);
  }

  console.log(`Ready. Sign in as ${email} at ${baseUrl}/auth`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$client.end());
