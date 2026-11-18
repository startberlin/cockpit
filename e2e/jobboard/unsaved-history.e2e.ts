import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect, firefox, webkit } from "@playwright/test";

const configuredUrl = process.env.JOBBOARD_TEST_COCKPIT_URL;
assert(
  configuredUrl,
  "Set JOBBOARD_TEST_COCKPIT_URL to the seeded local Cockpit.",
);
const url = new URL(configuredUrl);
assert(
  url.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
    url.href === `${url.origin}/`,
  "Use a loopback HTTP origin with no credentials, path or query.",
);

for (const engine of [chromium, firefox, webkit]) {
  test(`${engine.name()} keeps the unsaved editor and restores its history entry`, async (t) => {
    const browser = await engine.launch();
    t.after(() => browser.close());
    const context = await browser.newContext({ baseURL: url.origin });
    const login = await context.request.post("/api/auth/sign-in/dev", {
      data: { email: "jobboard-editor@example.test" },
      headers: { origin: url.origin },
      maxRedirects: 0,
    });
    assert.equal(
      login.status(),
      200,
      "Seed the local Jobboard Editor and enable dev login.",
    );

    const page = await context.newPage();
    await page.goto("/jobboard/jobs");
    await page.getByRole("link", { name: "Add job", exact: true }).click();
    const editor = `${url.origin}/jobboard/jobs/new`;
    await expect(page).toHaveURL(editor);
    await page.goBack();
    await expect(page).toHaveURL(`${url.origin}/jobboard/jobs`);
    await page.goForward();
    await expect(page).toHaveURL(editor);
    const title = page.getByRole("textbox", {
      name: "Job title",
      exact: false,
    });
    await title.fill("Unsaved local browser test");
    await expect(
      page.getByText("Unsaved changes", { exact: true }),
    ).toBeVisible();
    const originalLength = await page.evaluate(() => window.history.length);
    const dialog = page.getByRole("alertdialog", {
      name: "Leave without saving?",
    });

    await page.goBack({ waitUntil: "commit" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Keep editing" }).click();
    await expect(page).toHaveURL(editor);
    await expect(title).toHaveValue("Unsaved local browser test");

    await page.goBack({ waitUntil: "commit" });
    await dialog.getByRole("button", { name: "Discard changes" }).click();
    await expect(page).toHaveURL(`${url.origin}/jobboard/jobs`);
    await expect(
      page.getByRole("heading", { name: "Jobs", exact: true }),
    ).toBeVisible();

    await page.goForward({ waitUntil: "commit" });
    await expect(page).toHaveURL(editor);
    await expect(title).toHaveValue("");
    assert.equal(
      await page.evaluate(() => window.history.length),
      originalLength,
    );
  });
}
