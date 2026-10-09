import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { eq, TransactionRollbackError } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "@/db/schema";
import { user } from "@/db/schema/auth";
import { nanoid, newId } from "@/lib/id";
import { setupReferralCampaign } from "../lib/setup";
import type { CompletedSubmission } from "../lib/tally";
import { createTallyReader } from "../lib/tally-api";
import { configureReferralCampaign } from "./configure-campaign";
import {
  referralsCampaign,
  referralsLink,
  referralsSubmission,
} from "./schema";
import { createReferralStore } from "./store";

const connectionString = process.env.REFERRALS_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (
    !["localhost", "127.0.0.1", "::1"].includes(url.hostname) ||
    !/^\/start_cockpit_referrals_qa_\d+$/.test(url.pathname)
  ) {
    throw new Error(
      "Referral integration tests require an isolated localhost QA database",
    );
  }
}
const pool = new Pool({ connectionString });
const database = drizzle({ client: pool, schema });
type Tx = Parameters<Parameters<typeof database.transaction>[0]>[0];
const submittedAt = new Date("2026-10-09T12:00:00Z");

async function withFixture(
  run: (fixture: {
    tx: Tx;
    store: ReturnType<typeof createReferralStore>;
    memberId: string;
    otherId: string;
    campaignId: string;
    formId: string;
    submission: (id: string, code?: string) => CompletedSubmission;
  }) => Promise<void>,
) {
  try {
    await database.transaction(async (tx) => {
      const memberId = newId("user");
      const otherId = newId("user");
      const campaignId = `qa-${nanoid(12).toLowerCase()}`;
      const formId = nanoid(12);
      await tx.insert(user).values([
        {
          id: memberId,
          name: "QA Member",
          firstName: "QA",
          lastName: "Member",
          status: "member",
        },
        {
          id: otherId,
          name: "QA Supporting Member",
          firstName: "QA",
          lastName: "Supporting Member",
          status: "supporting_alumni",
        },
      ]);
      await tx.insert(referralsCampaign).values({
        id: campaignId,
        name: "QA Campaign",
        formId,
        applicationUrl: "https://apply.start-berlin.com/",
        refFieldKey: "question_hidden_ref",
        campaignFieldKey: "question_hidden_campaign",
        opensAt: new Date("2026-10-05T00:00:00+02:00"),
        closesAt: new Date("2026-10-27T00:00:00+01:00"),
      });
      await run({
        tx,
        store: createReferralStore(tx),
        memberId,
        otherId,
        campaignId,
        formId,
        submission: (id, code) => ({
          formId,
          submissionId: id,
          submittedAt,
          fields: [
            {
              key: "question_hidden_ref",
              type: "HIDDEN_FIELDS",
              value: code ?? null,
            },
            {
              key: "question_hidden_campaign",
              type: "HIDDEN_FIELDS",
              value: campaignId,
            },
          ],
        }),
      });
      tx.rollback();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) throw error;
  }
}

describe("referral PostgreSQL integration", { skip: !connectionString }, () => {
  after(() => pool.end());

  it("keeps one immutable code when many requests provision the same member concurrently", async () => {
    const memberId = newId("user");
    await database.insert(user).values({
      id: memberId,
      name: "QA Concurrent",
      firstName: "QA",
      lastName: "Concurrent",
      status: "member",
    });
    try {
      const store = createReferralStore(database);
      const links = await Promise.all(
        Array.from({ length: 12 }, () => store.ensureLink(memberId)),
      );
      assert.equal(new Set(links.map((link) => link.code)).size, 1);
      assert.equal(
        (
          await database
            .select()
            .from(referralsLink)
            .where(eq(referralsLink.userId, memberId))
        ).length,
        1,
      );
    } finally {
      await database
        .delete(referralsLink)
        .where(eq(referralsLink.userId, memberId));
      await database.delete(user).where(eq(user.id, memberId));
    }
  });

  it("makes campaign setup idempotent, refuses overlapping windows and protects attribution settings", async () =>
    withFixture(async ({ tx, campaignId, formId }) => {
      const config = {
        id: campaignId,
        name: "QA Campaign",
        batchNumber: null,
        formId,
        applicationUrl: "https://apply.start-berlin.com/",
        refFieldKey: "question_hidden_ref",
        campaignFieldKey: "question_hidden_campaign",
        opensAt: "2026-10-05T00:00:00+02:00",
        closesAt: "2026-10-27T00:00:00+01:00",
      };
      assert.equal(
        (await configureReferralCampaign(tx, config)).created,
        false,
      );
      await assert.rejects(
        configureReferralCampaign(tx, {
          ...config,
          refFieldKey: "question_changed",
        }),
        /immutable/,
      );
      await assert.rejects(
        configureReferralCampaign(tx, {
          ...config,
          id: `${campaignId}-overlap`,
          formId: nanoid(12),
        }),
        /overlaps/,
      );
      const dryRunConfig = {
        ...config,
        id: `${campaignId}-next`,
        formId: nanoid(12),
        opensAt: config.closesAt,
        closesAt: "2026-11-01T00:00:00+01:00",
      };
      await configureReferralCampaign(tx, dryRunConfig, { dryRun: true });
      assert.equal(
        (
          await tx
            .select()
            .from(referralsCampaign)
            .where(eq(referralsCampaign.id, dryRunConfig.id))
        ).length,
        0,
      );
      assert.equal(
        (
          await configureReferralCampaign(tx, {
            ...config,
            id: `${campaignId}-next`,
            formId: nanoid(12),
            opensAt: config.closesAt,
            closesAt: "2026-11-01T00:00:00+01:00",
          })
        ).created,
        true,
      );
    }));

  it("provisions every active member and preserves the code across repeated calls", async () =>
    withFixture(async ({ store, tx, memberId, otherId }) => {
      await store.provisionMembers();
      const first = await store.ensureLink(memberId);
      assert.equal((await store.ensureLink(memberId)).code, first.code);
      assert.notEqual((await store.ensureLink(otherId)).code, first.code);
      const rows = await tx
        .select()
        .from(referralsLink)
        .where(eq(referralsLink.userId, memberId));
      assert.equal(rows.length, 1);
      const cancelledId = newId("user");
      await tx.insert(user).values({
        id: cancelledId,
        name: "Cancelled",
        firstName: "QA",
        lastName: "Cancelled",
        status: "cancelled",
      });
      await assert.rejects(store.ensureLink(cancelledId));
    }));

  it("reuses the validated setup for retries without duplicate links or webhooks", async () =>
    withFixture(async ({ tx, campaignId, formId, memberId }) => {
      const config = {
        id: campaignId,
        name: "QA Campaign",
        batchNumber: null,
        formId,
        applicationUrl: "https://apply.start-berlin.com/",
        refFieldKey: "question_hidden_ref",
        campaignFieldKey: "question_hidden_campaign",
        opensAt: "2026-10-05T00:00:00+02:00",
        closesAt: "2026-10-27T00:00:00+01:00",
      };
      const endpoint = "https://cockpit.start-berlin.com/api/tally/referrals";
      let connected = false;
      const methods: string[] = [];
      const fetcher: typeof fetch = async (input, init) => {
        if (String(input).endsWith("/questions"))
          return Response.json({
            questions: [
              {
                id: "hidden",
                type: "HIDDEN_FIELDS",
                fields: [
                  { uuid: "ref", type: "HIDDEN_FIELD", title: "ref" },
                  {
                    uuid: "campaign",
                    type: "HIDDEN_FIELD",
                    title: "campaign",
                  },
                ],
              },
            ],
          });
        if (!init?.method)
          return Response.json({
            page: 1,
            hasMore: false,
            webhooks: connected ? [{ id: "owned", formId, url: endpoint }] : [],
          });
        methods.push(init.method);
        const body = JSON.parse(String(init.body));
        assert.equal(body.url, endpoint);
        assert.equal(body.formId, formId);
        assert.notEqual(body.signingSecret, "test-key");
        connected = true;
        return Response.json({ id: "owned" });
      };
      const options = {
        apiKey: "test-key",
        cockpitUrl: "https://cockpit.start-berlin.com",
        connectWebhook: true,
        fetcher,
      };
      const first = await setupReferralCampaign(tx, config, options);
      assert.deepEqual(first, {
        created: false,
        provisioned: 2,
        webhookConnected: true,
      });
      const [link] = await tx
        .select()
        .from(referralsLink)
        .where(eq(referralsLink.userId, memberId));
      const repeated = await setupReferralCampaign(tx, config, options);
      assert.deepEqual(repeated, {
        created: false,
        provisioned: 0,
        webhookConnected: true,
      });
      const [preserved] = await tx
        .select()
        .from(referralsLink)
        .where(eq(referralsLink.userId, memberId));
      assert.equal(preserved.code, link.code);
      assert.deepEqual(methods, ["POST", "PATCH"]);
      assert.equal("signingSecret" in first, false);
      assert.equal("apiKey" in first, false);
    }));

  it("validates setup dry runs without provisioning links or connecting a webhook", async () =>
    withFixture(async ({ tx, campaignId }) => {
      const config = {
        id: `${campaignId}-dry-run`,
        name: "QA Next Campaign",
        batchNumber: null,
        formId: nanoid(12),
        applicationUrl: "https://apply.start-berlin.com/",
        refFieldKey: "question_hidden_ref",
        campaignFieldKey: "question_hidden_campaign",
        opensAt: "2026-10-27T00:00:00+01:00",
        closesAt: "2026-11-01T00:00:00+01:00",
      };
      const result = await setupReferralCampaign(tx, config, {
        apiKey: "test-key",
        cockpitUrl: "https://cockpit.start-berlin.com",
        dryRun: true,
        connectWebhook: true,
        fetcher: async (input) => {
          assert.equal(String(input).endsWith("/questions"), true);
          return Response.json([
            {
              id: "hidden",
              type: "HIDDEN_FIELDS",
              fields: [
                { uuid: "ref", type: "HIDDEN_FIELD", title: "ref" },
                {
                  uuid: "campaign",
                  type: "HIDDEN_FIELD",
                  title: "campaign",
                },
              ],
            },
          ]);
        },
      });
      assert.deepEqual(result, {
        created: false,
        provisioned: 0,
        webhookConnected: false,
      });
      assert.equal((await tx.select().from(referralsLink)).length, 0);
      assert.equal(
        (
          await tx
            .select()
            .from(referralsCampaign)
            .where(eq(referralsCampaign.id, config.id))
        ).length,
        0,
      );
    }));

  it("refuses unmatched Tally field metadata before setup can write data", async () =>
    withFixture(async ({ tx, campaignId, formId }) => {
      await assert.rejects(
        setupReferralCampaign(
          tx,
          {
            id: `${campaignId}-next`,
            name: "QA Next Campaign",
            batchNumber: null,
            formId,
            applicationUrl: "https://apply.start-berlin.com/",
            refFieldKey: "question_hidden_ref",
            campaignFieldKey: "question_hidden_campaign",
            opensAt: "2026-10-27T00:00:00+01:00",
            closesAt: "2026-11-01T00:00:00+01:00",
          },
          {
            apiKey: "test-key",
            cockpitUrl: "https://cockpit.start-berlin.com",
            connectWebhook: true,
            fetcher: async () => Response.json({ questions: [] }),
          },
        ),
        /published Tally hidden fields/,
      );
      assert.equal((await tx.select().from(referralsLink)).length, 0);
      assert.equal(
        (
          await tx
            .select()
            .from(referralsCampaign)
            .where(eq(referralsCampaign.id, `${campaignId}-next`))
        ).length,
        0,
      );
    }));

  it("credits a signed-source submission once and isolates the two members' counts", async () =>
    withFixture(async ({ store, memberId, otherId, submission }) => {
      const link = await store.ensureLink(memberId);
      const other = await store.ensureLink(otherId);
      assert.equal(
        (await store.ingest(submission("first", link.code))).inserted,
        true,
      );
      assert.equal(
        (await store.ingest(submission("first", other.code))).inserted,
        false,
      );
      await store.ingest(submission("second", other.code));
      assert.equal(
        (await store.myDashboard(memberId, submittedAt)).currentCount,
        1,
      );
      assert.equal(
        (await store.myDashboard(otherId, submittedAt)).currentCount,
        1,
      );
    }));

  it("stores every attribution failure without crediting a member", async () =>
    withFixture(async ({ store, tx, memberId, submission }) => {
      const link = await store.ensureLink(memberId);
      const missing = submission("missing");
      const unknown = submission("unknown", "unknown-code");
      const wrong = submission("wrong", link.code);
      wrong.fields[1].value = "other-campaign";
      const outside = {
        ...submission("outside", link.code),
        submittedAt: new Date("2026-10-27T00:00:00Z"),
      };
      const invalid = submission("invalid", link.code);
      invalid.fields.push(invalid.fields[0]);
      assert.equal((await store.ingest(missing)).status, "missing_code");
      assert.equal(
        (
          await store.ingest({
            ...submission("direct-application"),
            fields: [],
          })
        ).status,
        "missing_code",
      );
      assert.equal((await store.ingest(unknown)).status, "unknown_code");
      assert.equal((await store.ingest(wrong)).status, "wrong_campaign");
      assert.equal((await store.ingest(outside)).status, "outside_window");
      assert.equal((await store.ingest(invalid)).status, "invalid_fields");
      assert.equal(
        (await store.myDashboard(memberId, submittedAt)).currentCount,
        0,
      );
      assert.equal(
        (await tx.select().from(referralsSubmission)).every(
          (row) => row.linkId === null,
        ),
        true,
      );
    }));

  it("attributes direct apply submissions by form when campaign is missing or empty", async () =>
    withFixture(async ({ store, memberId, otherId, submission }) => {
      const link = await store.ensureLink(memberId);
      const absent = submission("without-campaign", link.code);
      absent.fields = [absent.fields[0]];
      const empty = submission("empty-campaign", link.code);
      empty.fields[1].value = "";
      const nullValue = submission("null-campaign", link.code);
      nullValue.fields[1].value = null;
      for (const value of [absent, empty, nullValue])
        assert.equal((await store.ingest(value)).status, "matched");

      const malformed = submission("malformed-campaign", link.code);
      malformed.fields[1].value = 123;
      assert.equal((await store.ingest(malformed)).status, "invalid_fields");
      const ambiguous = submission("ambiguous-campaign", link.code);
      ambiguous.fields.push(ambiguous.fields[1]);
      assert.equal((await store.ingest(ambiguous)).status, "invalid_fields");
      const wrong = submission("foreign-campaign", link.code);
      wrong.fields[1].value = "another-campaign";
      assert.equal((await store.ingest(wrong)).status, "wrong_campaign");
      assert.equal(
        (await store.myDashboard(memberId, submittedAt)).currentCount,
        3,
      );
      assert.equal(
        (await store.myDashboard(otherId, submittedAt)).currentCount,
        0,
      );
    }));

  it("uses submission time for delayed delivery and treats the closing instant as exclusive", async () =>
    withFixture(async ({ store, memberId, submission }) => {
      const link = await store.ensureLink(memberId);
      const last = {
        ...submission("last", link.code),
        submittedAt: new Date("2026-10-26T22:59:59.999Z"),
      };
      const late = {
        ...submission("late", link.code),
        submittedAt: new Date("2026-10-26T23:00:00.000Z"),
      };
      const early = {
        ...submission("early", link.code),
        submittedAt: new Date("2026-10-04T21:59:59.999Z"),
      };
      assert.equal((await store.ingest(last)).status, "matched");
      assert.equal((await store.ingest(late)).status, "outside_window");
      assert.equal((await store.ingest(early)).status, "outside_window");
      assert.equal(
        (await store.resolveLink(link.code, late.submittedAt)).status,
        "closed",
      );
    }));

  it("preserves one public link while rotating campaign and keeps historical counts", async () =>
    withFixture(async ({ store, tx, memberId, campaignId, submission }) => {
      const link = await store.ensureLink(memberId);
      await store.ingest(submission("old", link.code));
      await tx.insert(referralsCampaign).values({
        id: `${campaignId}-next`,
        name: "Next campaign",
        formId: nanoid(12),
        applicationUrl: "https://apply.start-berlin.com/",
        refFieldKey: "question_ref",
        campaignFieldKey: "question_campaign",
        opensAt: new Date("2027-04-01T00:00:00Z"),
        closesAt: new Date("2027-04-30T00:00:00Z"),
      });
      const now = new Date("2027-04-10T00:00:00Z");
      const result = await store.resolveLink(link.code, now);
      assert.equal(result.status, "open");
      if (result.status === "open")
        assert.equal(
          new URL(result.url).searchParams.get("campaign"),
          `${campaignId}-next`,
        );
      const data = await store.myDashboard(memberId, now);
      assert.equal(data.code, link.code);
      assert.equal(data.currentCount, 0);
      assert.equal(data.totalCount, 1);
    }));

  it("keeps codes reserved after owner deletion and denies inactive public links", async () =>
    withFixture(async ({ store, tx, memberId }) => {
      const link = await store.ensureLink(memberId);
      await tx
        .update(user)
        .set({ status: "cancelled" })
        .where(eq(user.id, memberId));
      assert.equal(
        (await store.resolveLink(link.code, submittedAt)).status,
        "unknown_link",
      );
      await tx.delete(user).where(eq(user.id, memberId));
      const [preserved] = await tx
        .select()
        .from(referralsLink)
        .where(eq(referralsLink.code, link.code));
      assert.equal(preserved.userId, null);
    }));

  it("preserves timely attribution after the link owner becomes inactive or is deleted", async () =>
    withFixture(async ({ store, tx, memberId, campaignId, submission }) => {
      const link = await store.ensureLink(memberId);
      await tx
        .update(user)
        .set({ status: "cancelled" })
        .where(eq(user.id, memberId));
      const delayed = submission("delayed-after-cancellation", link.code);
      delayed.fields = [delayed.fields[0]];
      assert.equal((await store.ingest(delayed)).status, "matched");
      await tx.delete(user).where(eq(user.id, memberId));
      const afterDeletion = submission("delayed-after-deletion", link.code);
      afterDeletion.fields = [afterDeletion.fields[0]];
      assert.equal((await store.ingest(afterDeletion)).status, "matched");
      const rows = await tx
        .select()
        .from(referralsSubmission)
        .where(eq(referralsSubmission.campaignId, campaignId));
      assert.equal(rows.length, 2);
      assert.equal(
        rows.every((row) => row.linkId === link.id),
        true,
      );
      const overview = await store.overview();
      assert.equal(
        overview.members.some((member) => member.code === link.code),
        false,
      );
      assert.equal(
        overview.statuses.find((row) => row.status === "matched")?.count,
        2,
      );
    }));

  it("attributes and deduplicates API and webhook submissions in either delivery order", async () => {
    for (const [apiFirst, includeCampaign] of [
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ])
      await withFixture(
        async ({
          store,
          tx,
          memberId,
          otherId,
          campaignId,
          formId,
          submission,
        }) => {
          const questionId = "y0Xr16";
          const refUuid = "c709d80c-88d2-4975-95dc-f0099435ed01";
          const campaignUuid = "a6f886ea-97a1-4aaa-bb5b-50472a8c985f";
          const refFieldKey = `question_${questionId}_${refUuid}`;
          const campaignFieldKey = `question_${questionId}_${campaignUuid}`;
          await tx
            .update(referralsCampaign)
            .set({ refFieldKey, campaignFieldKey })
            .where(eq(referralsCampaign.id, campaignId));
          const link = await store.ensureLink(memberId);
          const webhook = {
            ...submission("shared", link.code),
            fields: [
              { key: refFieldKey, type: "HIDDEN_FIELDS", value: link.code },
              ...(includeCampaign
                ? [
                    {
                      key: campaignFieldKey,
                      type: "HIDDEN_FIELDS",
                      value: campaignId,
                    },
                  ]
                : []),
            ],
          };
          if (!apiFirst) await store.ingest(webhook);
          const reader = createTallyReader("test-key", async () =>
            Response.json({
              page: 1,
              hasMore: false,
              questions: [
                {
                  id: questionId,
                  type: "HIDDEN_FIELDS",
                  fields: [
                    { uuid: refUuid, type: "HIDDEN_FIELD", title: "ref" },
                    {
                      uuid: campaignUuid,
                      type: "HIDDEN_FIELD",
                      title: "campaign",
                    },
                  ],
                },
              ],
              submissions: [
                {
                  id: "shared",
                  formId,
                  isCompleted: true,
                  submittedAt: submittedAt.toISOString(),
                  responses: [
                    {
                      questionId,
                      answer: {
                        ref: link.code,
                        ...(includeCampaign ? { campaign: campaignId } : {}),
                      },
                    },
                  ],
                },
              ],
            }),
          );
          const result = await reader.reconcile(formId, store.ingest);
          assert.equal(result.inserted, apiFirst ? 1 : 0);
          assert.equal(result.duplicates, apiFirst ? 0 : 1);
          assert.equal((await store.ingest(webhook)).inserted, false);
          const [saved] = await tx
            .select()
            .from(referralsSubmission)
            .where(eq(referralsSubmission.campaignId, campaignId));
          assert.equal(saved.status, "matched");
          assert.equal(saved.linkId, link.id);
          assert.equal(
            (await store.myDashboard(memberId, submittedAt)).currentCount,
            1,
          );
          assert.equal(
            (await store.myDashboard(otherId, submittedAt)).currentCount,
            0,
          );
        },
      );
  });

  it("does not persist unrelated forms and provides aggregate diagnostics", async () =>
    withFixture(async ({ store, memberId, submission }) => {
      const link = await store.ensureLink(memberId);
      assert.equal(
        (
          await store.ingest({
            ...submission("unrelated", link.code),
            formId: "unrelated",
          })
        ).inserted,
        false,
      );
      await store.ingest(submission("valid", link.code));
      await store.ingest(submission("missing"));
      const overview = await store.overview();
      assert.equal(
        overview.members.find((row) => row.name === "QA Member")?.applications,
        1,
      );
      assert.equal(
        overview.members.find((row) => row.name === "QA Member")?.code,
        link.code,
      );
      assert.equal(
        overview.statuses.find((row) => row.status === "missing_code")?.count,
        1,
      );
    }));
});
