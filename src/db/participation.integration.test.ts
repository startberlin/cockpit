import assert from "node:assert/strict";
import { it } from "node:test";
import { count, eq } from "drizzle-orm";
import { auditLog, user } from "@/db/schema";
import { newId } from "@/lib/id";

const connectionString = process.env.PARTICIPATION_TEST_DATABASE_URL;

// Run against a migrated localhost QA database with --conditions=react-server.
it("guards participation and audit writes against department changes", {
  skip: !connectionString,
}, async (t) => {
  assert.ok(connectionString);
  const url = new URL(connectionString);
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      /^\/start_cockpit_participation_qa_\d+$/.test(url.pathname),
    "Participation integration tests require an isolated localhost QA database",
  );

  process.env.DATABASE_URL = connectionString;
  process.env.ENABLE_DEV_LOGIN = "true";
  process.env.DISABLE_GOOGLE_WORKSPACE = "true";
  process.env.DISABLE_EMAIL = "true";
  process.env.BETTER_AUTH_SECRET ??= "participation-test-only";
  process.env.AWS_REGION ??= "eu-central-1";
  process.env.AWS_ACCESS_KEY_ID ??= "test";
  process.env.AWS_SECRET_ACCESS_KEY ??= "test";
  process.env.AWS_SES_SNS_TOPIC_ARN ??= "test";
  process.env.NEXT_PUBLIC_COCKPIT_URL ??= "http://localhost:3000";

  const { default: db } = await import("./index");
  const { changeParticipationPause } = await import("./participation");
  const userId = newId("user");
  t.after(async () => {
    try {
      await db.delete(auditLog).where(eq(auditLog.subjectId, userId));
      await db.delete(user).where(eq(user.id, userId));
    } finally {
      await db.$client.end();
    }
  });

  const readParticipation = async () => {
    const member = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { participationPausedAt: true },
    });
    assert.ok(member);
    const [audit] = await db
      .select({ total: count() })
      .from(auditLog)
      .where(eq(auditLog.subjectId, userId));
    return {
      timestamp: member.participationPausedAt?.toISOString() ?? null,
      audits: audit?.total,
    };
  };

  await db.insert(user).values({
    id: userId,
    name: "QA Member",
    firstName: "QA",
    lastName: "Member",
    status: "member",
    department: "events",
  });
  await db.update(user).set({ department: null }).where(eq(user.id, userId));

  assert.equal(
    await changeParticipationPause({
      userId,
      actor: "system",
      expectedDepartment: "events",
      expectedPausedAt: null,
    }),
    null,
  );
  assert.deepEqual(await readParticipation(), { timestamp: null, audits: 0 });

  const pause = await changeParticipationPause({
    userId,
    actor: "system",
    expectedDepartment: null,
    expectedPausedAt: null,
  });
  assert.equal(pause?.paused, true);
  const paused = await readParticipation();
  assert.ok(paused.timestamp);
  assert.equal(paused.audits, 1);

  await db
    .update(user)
    .set({ department: "growth" })
    .where(eq(user.id, userId));
  assert.equal(
    await changeParticipationPause({
      userId,
      actor: "system",
      expectedDepartment: null,
      expectedPausedAt: paused.timestamp,
    }),
    null,
  );
  assert.deepEqual(await readParticipation(), paused);
});
