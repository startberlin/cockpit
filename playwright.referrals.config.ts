import { defineConfig } from "@playwright/test";

const connectionString = process.env.REFERRALS_TEST_DATABASE_URL;
if (!connectionString)
  throw new Error(
    "Set REFERRALS_TEST_DATABASE_URL to an isolated local QA database",
  );
const databaseUrl = new URL(connectionString);
if (
  !["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) ||
  !/^\/start_cockpit_referrals_qa_\d+$/.test(databaseUrl.pathname)
)
  throw new Error("Browser tests require an isolated localhost QA database");
const baseURL = "http://localhost:3107";

export default defineConfig({
  testDir: "./e2e/referrals",
  testMatch: "*.e2e.ts",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: ".generated/referrals/browser-results",
  reporter: "list",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    locale: "en-GB",
    timezoneId: "Europe/Berlin",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-webkit",
      use: {
        browserName: "webkit",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "npm run next:dev -- --hostname localhost --port 3107",
    url: `${baseURL}/auth`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: connectionString,
      BETTER_AUTH_URL: baseURL,
      NEXT_PUBLIC_COCKPIT_URL: baseURL,
      BETTER_AUTH_SECRET: "local-referrals-browser-test-secret-only",
      TALLY_REFERRALS_WEBHOOK_SECRET:
        "local-referrals-browser-signature-test-only",
      ENABLE_DEV_LOGIN: "true",
      DISABLE_EMAIL: "true",
      DISABLE_GOOGLE_WORKSPACE: "true",
      DISABLE_SLACK: "true",
      WATCHPACK_POLLING: "1000",
      AWS_REGION: "eu-central-1",
      AWS_ACCESS_KEY_ID: "local-test",
      AWS_SECRET_ACCESS_KEY: "local-test",
      AWS_SES_SNS_TOPIC_ARN: "arn:aws:sns:eu-central-1:000000000000:local-test",
    },
  },
});
