import { createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "@/db/schema";
import { user } from "@/db/schema/auth";
import { userOrganizationPosition } from "@/db/schema/authority";
import {
  referralsCampaign,
  referralsLink,
  referralsSubmission,
} from "@/internal-apps/referrals/db/schema";
import { createReferralStore } from "@/internal-apps/referrals/db/store";
import { nanoid, newId } from "@/lib/id";

const pool = new Pool({
  connectionString: process.env.REFERRALS_TEST_DATABASE_URL,
});
const db = drizzle({ client: pool, schema });
const store = createReferralStore(db);
const campaignId = `qa-${nanoid(12).toLowerCase()}`;
const formId = nanoid(12);
const members = {
  member: {
    id: newId("user"),
    email: `member-${nanoid(8).toLowerCase()}@referrals.invalid`,
    name: "QA Member",
  },
  other: {
    id: newId("user"),
    email: `other-${nanoid(8).toLowerCase()}@referrals.invalid`,
    name: "QA Other Member",
  },
  head: {
    id: newId("user"),
    email: `head-${nanoid(8).toLowerCase()}@referrals.invalid`,
    name: "QA Head",
  },
  cancelled: {
    id: newId("user"),
    email: `cancelled-${nanoid(8).toLowerCase()}@referrals.invalid`,
    name: "QA Cancelled",
  },
  former: {
    id: newId("user"),
    email: `former-${nanoid(8).toLowerCase()}@referrals.invalid`,
    name: "QA Former",
  },
};
let code = "";
let otherCode = "";

async function login(page: Page, email = members.member.email) {
  const response = await page.request.post("/api/auth/sign-in/dev", {
    data: { email },
    headers: { Origin: "http://localhost:3107" },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

test.beforeAll(async () => {
  const now = new Date();
  await db.insert(referralsCampaign).values({
    id: campaignId,
    name: "Batch #11 · Fall 2026",
    formId,
    applicationUrl: "https://apply.start-berlin.com/",
    refFieldKey: "question_ref",
    campaignFieldKey: "question_campaign",
    opensAt: new Date(now.getTime() - 86_400_000),
    closesAt: new Date(now.getTime() + 17 * 86_400_000),
  });
  for (const [role, member] of Object.entries(members))
    await db.insert(user).values({
      ...member,
      firstName: "QA",
      lastName: role,
      status: role === "cancelled" ? "cancelled" : "member",
      personalEmail: member.email,
      phone: "+4915112345678",
      birthDate: "2000-01-01",
      eventEmailPreference: "personal_email",
    });
  await db.insert(userOrganizationPosition).values({
    userId: members.head.id,
    position: "department_head",
    scope: "department",
    department: "events",
  });
  await store.provisionMembers();
  code = (await store.ensureLink(members.member.id)).code;
  otherCode = (await store.ensureLink(members.other.id)).code;
  const formerCode = (await store.ensureLink(members.former.id)).code;
  for (let index = 0; index < 3; index++)
    await store.ingest({
      formId,
      submissionId: `former-${index}`,
      submittedAt: now,
      fields: [
        { key: "question_ref", type: "HIDDEN_FIELDS", value: formerCode },
        { key: "question_campaign", type: "HIDDEN_FIELDS", value: campaignId },
      ],
    });
  await db
    .update(user)
    .set({ status: "alumni" })
    .where(eq(user.id, members.former.id));
  for (let index = 0; index < 7; index++)
    await store.ingest({
      formId,
      submissionId: `seed-${index}`,
      submittedAt: now,
      fields: [
        { key: "question_ref", type: "HIDDEN_FIELDS", value: code },
        { key: "question_campaign", type: "HIDDEN_FIELDS", value: campaignId },
      ],
    });
  await store.ingest({
    formId,
    submissionId: "seed-missing",
    submittedAt: now,
    fields: [
      { key: "question_campaign", type: "HIDDEN_FIELDS", value: campaignId },
    ],
  });
});

test.afterAll(async () => {
  await db
    .delete(referralsSubmission)
    .where(eq(referralsSubmission.campaignId, campaignId));
  await db
    .delete(referralsCampaign)
    .where(eq(referralsCampaign.id, campaignId));
  const ids = Object.values(members).map((member) => member.id);
  await db.delete(referralsLink).where(inArray(referralsLink.userId, ids));
  await db.delete(user).where(inArray(user.id, ids));
  await pool.end();
});

test("launcher, own count and immutable link work on mobile and desktop", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  await page.goto("/tools");
  await expect(
    page.getByRole("main").getByText("Referrals", { exact: true }),
  ).toBeVisible();
  const openedApp = page.context().waitForEvent("page");
  await page.getByRole("link", { name: "Open Referrals", exact: true }).click();
  page = await openedApp;
  page.on("pageerror", (error) => errors.push(error.message));
  const clientSessionReady = page
    .waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth/get-session") &&
        response.status() === 200,
    )
    .then((response) => response.finished());
  await expect(
    page.getByRole("heading", { name: "My referrals" }),
  ).toBeVisible();
  await clientSessionReady;
  await expect(
    page.getByRole("main").getByText("7", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Overview" })).toHaveCount(0);
  await expect(
    page.getByRole("main").getByRole("link", { name: "Overview" }),
  ).toHaveCount(0);
  if (testInfo.project.use.isMobile)
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  await expect(
    sidebar.getByRole("link", { name: "My referrals", exact: true }),
  ).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Overview" })).toHaveCount(0);
  if (testInfo.project.use.isMobile) {
    await sidebar
      .getByRole("link", { name: "My referrals", exact: true })
      .click();
    await expect(page.getByRole("dialog", { name: "Sidebar" })).toBeHidden();
  }
  await expect(page.locator("input")).toHaveCount(0);
  await page.goto(`/referrals?userId=${members.other.id}`);
  await expect(
    page.getByRole("main").getByText("7", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByText(`https://apply.start-berlin.com/?ref=${code}`, {
        exact: true,
      }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await page
        .getByRole("button", { name: "Copy link", exact: true })
        .boundingBox()
    )?.height,
  ).toBeGreaterThanOrEqual(44);
  await mkdir(".generated/referrals/visuals", { recursive: true });
  await page.screenshot({
    path: `.generated/referrals/visuals/${testInfo.project.name}-member.png`,
    fullPage: true,
    style: "nextjs-portal { display: none; }",
  });
  expect(errors).toEqual([]);
});

test("copy, share fallback and keyboard interaction preserve the stored link", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as unknown as { copied: string }).copied = value;
        },
      },
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
  });
  await login(page);
  await page.goto("/referrals");
  await page.getByRole("button", { name: "Copy link", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { copied: string }).copied),
  ).toBe(`https://apply.start-berlin.com/?ref=${code}`);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Link copied");
});

test("native share succeeds, cancellation is quiet and clipboard failure has a fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (value: unknown) => {
        (window as unknown as { shared: unknown }).shared = value;
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Clipboard denied");
        },
      },
    });
  });
  await login(page);
  await page.goto("/referrals");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Link shared");
  expect(
    await page.evaluate(
      () => (window as unknown as { shared: { url: string } }).shared.url,
    ),
  ).toBe(`https://apply.start-berlin.com/?ref=${code}`);
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Copy the link above.");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      value: async () => {
        throw new DOMException("Cancelled", "AbortError");
      },
    }),
  );
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Copy the link above.");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      value: async () => {
        throw new Error("Unavailable");
      },
    }),
  );
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Sharing failed. Copy the link instead.",
  );
});

test("anonymous, cancelled and ordinary members cannot open the overview", async ({
  page,
}) => {
  await page.goto("/referrals");
  await expect(page).toHaveURL(/\/auth/);
  await login(page);
  await page.goto("/referrals/overview");
  await expect(page).toHaveURL(/\/referrals$/);
  await login(page, members.cancelled.email);
  await page.goto("/referrals");
  await expect(page).toHaveURL(/\/tools$/);
});

test("heads navigate to the overview in the sidebar without an admin grant", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as unknown as { copied: string }).copied = value;
        },
      },
    });
  });
  await login(page, members.head.email);
  await page.goto("/referrals");
  await expect(
    page.getByRole("main").getByRole("link", { name: "Overview" }),
  ).toHaveCount(0);
  if (testInfo.project.use.isMobile)
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const overviewLink = sidebar.getByRole("link", {
    name: "Overview",
    exact: true,
  });
  await expect(overviewLink).toBeVisible();
  await overviewLink.click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  if (testInfo.project.use.isMobile)
    await expect(page.getByRole("dialog", { name: "Sidebar" })).toBeHidden();
  await expect(
    page.getByRole("main").getByRole("link", {
      name: "My referrals",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "QA Member", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByText("Without a code", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Former members", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "QA Former", exact: true }),
  ).toHaveCount(0);
  const otherRow = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: "QA Other Member", exact: true }),
  });
  const copyOther = otherRow.getByRole("button", {
    name: "Copy referral link for QA Other Member",
    exact: true,
  });
  await expect(copyOther).toHaveAttribute(
    "title",
    `https://apply.start-berlin.com/?ref=${otherCode}`,
  );
  await copyOther.focus();
  await page.keyboard.press("Enter");
  expect(
    await page.evaluate(() => (window as unknown as { copied: string }).copied),
  ).toBe(`https://apply.start-berlin.com/?ref=${otherCode}`);
  await expect(otherRow.getByRole("status")).toHaveText("Link copied");
  expect((await copyOther.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.generated/referrals/visuals/${testInfo.project.name}-overview.png`,
    fullPage: true,
    style: "nextjs-portal { display: none; }",
  });
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Clipboard denied");
        },
      },
    }),
  );
  await copyOther.click();
  await expect(
    page
      .locator("[data-sonner-toast]")
      .getByText("Copying failed. Try again.", { exact: true }),
  ).toBeVisible();
  if (testInfo.project.use.isMobile)
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(overviewLink).toHaveAttribute("data-active", "true");
  await sidebar
    .getByRole("link", { name: "My referrals", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My referrals" }),
  ).toBeVisible();
  if (testInfo.project.use.isMobile)
    await expect(page.getByRole("dialog", { name: "Sidebar" })).toBeHidden();
});

test("public link carries trusted parameters; signed concurrent deliveries count once", async ({
  page,
  request,
}, testInfo) => {
  const redirect = await request.get(
    `/r/${code}?ref=changed&campaign=changed`,
    { maxRedirects: 0 },
  );
  expect(redirect.status()).toBe(302);
  const url = new URL(redirect.headers().location);
  expect(url.searchParams.get("ref")).toBe(code);
  expect(url.searchParams.get("campaign")).toBe(campaignId);
  expect(redirect.headers()["cache-control"]).toContain("no-store");
  expect((await request.get("/r/unknown", { maxRedirects: 0 })).status()).toBe(
    404,
  );
  await login(page);
  await page.goto("/referrals");
  await expect(
    page.getByRole("main").getByText("7", { exact: true }),
  ).toBeVisible();
  const event = {
    eventId: "browser-event",
    eventType: "FORM_RESPONSE",
    data: {
      formId,
      submissionId: "browser-complete",
      createdAt: new Date().toISOString(),
      fields: [
        { key: "question_ref", type: "HIDDEN_FIELDS", value: code },
        { key: "question_campaign", type: "HIDDEN_FIELDS", value: campaignId },
      ],
    },
  };
  const send = (payload: unknown, sign = true) =>
    request.post("/api/tally/referrals", {
      data: payload,
      headers: sign
        ? {
            "Tally-Signature": createHmac(
              "sha256",
              "local-referrals-browser-signature-test-only",
            )
              .update(JSON.stringify(payload))
              .digest("base64"),
          }
        : {},
    });
  expect((await send(event, false)).status()).toBe(401);
  for (const response of await Promise.all(
    Array.from({ length: 8 }, () => send(event)),
  ))
    expect(response.status()).toBe(200);
  expect(
    (
      await send({
        ...event,
        data: { ...event.data, submissionId: "partial", isCompleted: false },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "Refresh statistics" }).click();
  await expect(
    page.getByRole("main").getByText("8", { exact: true }),
  ).toBeVisible();
  await login(page, members.other.email);
  await page.goto("/referrals");
  await expect(
    page.getByRole("main").getByText("0", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `.generated/referrals/visuals/${testInfo.project.name}-empty.png`,
    fullPage: true,
    style: "nextjs-portal { display: none; }",
  });
});

test("narrow mobile, tablet and wide desktop do not overflow", async ({
  page,
}, testInfo) => {
  await login(page);
  for (const width of [320, 375, 768, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/referrals");
    await expect(
      page.getByRole("button", { name: "Copy link", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (testInfo.project.name === "desktop-chromium")
      await page.screenshot({
        path: `.generated/referrals/visuals/width-${width}.png`,
        fullPage: true,
        style: "nextjs-portal { display: none; }",
      });
  }
});

test("closed and unconfigured campaigns keep the personal link and stop redirects", async ({
  page,
  request,
}, testInfo) => {
  await db
    .update(referralsCampaign)
    .set({ closesAt: new Date(Date.now() - 1000) })
    .where(eq(referralsCampaign.id, campaignId));
  expect((await request.get(`/r/${code}`, { maxRedirects: 0 })).status()).toBe(
    410,
  );
  await login(page);
  await page.goto("/referrals");
  await expect(
    page.getByRole("main").getByText("Applications closed", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByText(`https://apply.start-berlin.com/?ref=${code}`, {
        exact: true,
      }),
  ).toBeVisible();
  await page.screenshot({
    path: `.generated/referrals/visuals/${testInfo.project.name}-closed.png`,
    fullPage: true,
    style: "nextjs-portal { display: none; }",
  });
  await db
    .update(referralsCampaign)
    .set({ enabled: false })
    .where(eq(referralsCampaign.id, campaignId));
  await page.reload();
  await expect(
    page.getByRole("main").getByText("8", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `.generated/referrals/visuals/${testInfo.project.name}-unconfigured.png`,
    fullPage: true,
    style: "nextjs-portal { display: none; }",
  });
});
