import { createEnv } from "@t3-oss/env-nextjs";
import z from "zod";

// Resolve the Workspace flag up front so the Google service-account vars can be
// made optional when the integration is turned off (e.g. local development).
// Login vars (GOOGLE_CLIENT_ID/SECRET) are intentionally excluded — OAuth login
// is independent of Workspace and always required.
const googleWorkspaceDisabled = z
  .stringbool()
  .optional()
  .default(false)
  .catch(false)
  .parse(process.env.DISABLE_GOOGLE_WORKSPACE);

const workspaceString = googleWorkspaceDisabled
  ? z.string().optional()
  : z.string().min(1);

// Dev login is a passwordless bypass. `src/lib/auth-dev-login.ts` hard-blocks
// the endpoint in production; forcing the flag off here keeps the plugin
// unregistered and the auth page from offering it, even if the var is set.
const devLoginBlocked = process.env.NODE_ENV === "production";

// Same trick as the Workspace flag: with the passwordless local login enabled,
// the app can run without a Google OAuth client, so the login vars become
// optional. In production the flag is blocked, so they stay required.
const devLoginEnabled =
  !devLoginBlocked &&
  z
    .stringbool()
    .optional()
    .default(false)
    .catch(false)
    .parse(process.env.ENABLE_DEV_LOGIN);

const googleLoginString = devLoginEnabled
  ? z.string().min(1).optional()
  : z.string().min(1);

// Optional credentials are routinely left blank in a local `.env` rather than
// deleted (e.g. `OPENAI_API_KEY=`). An empty string is still a string, so a
// plain `.min(1).optional()` would reject it and take the whole app down over a
// feature that is meant to be switched off. Treat "blank" as "unset".
const optionalSecret = z.string().min(1).optional().catch(undefined);

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.url().optional().default("http://localhost:3000"),
    GOOGLE_CLIENT_ID: googleLoginString,
    GOOGLE_CLIENT_SECRET: googleLoginString,
    AWS_REGION: z.string().min(1),
    AWS_ACCESS_KEY_ID: z.string().min(1),
    AWS_SECRET_ACCESS_KEY: z.string().min(1),
    AWS_SES_SNS_TOPIC_ARN: z.string().min(1),
    GOOGLE_APPLICATION_CREDENTIALS_BASE64: workspaceString,
    SLACK_BOT_TOKEN: z.string().min(1).optional(),
    GOCARDLESS_API_KEY: z.string().min(1).optional(),
    GOCARDLESS_ENVIRONMENT: z
      .enum(["live", "sandbox"])
      .optional()
      .default("live"),
    GOCARDLESS_WEBHOOK_SECRET: z.string().min(1).optional(),
    GOOGLE_DRIVE_LEGAL_DOCUMENTS_FOLDER_ID: workspaceString,
    BETTERSTACK_HEARTBEAT_URL_PAYMENT_PROPOSALS: z.url().optional(),
    BETTERSTACK_HEARTBEAT_URL_GROUP_RECONCILIATION: z.url().optional(),
    DISABLE_EMAIL: z.stringbool().optional().default(false),
    DISABLE_GOOGLE_WORKSPACE: z.stringbool().optional().default(false),
    DISABLE_SLACK: z.stringbool().optional().default(false),
    // Local-only passwordless login. The endpoint itself is hard-blocked when
    // NODE_ENV=production (see src/lib/auth-dev-login.ts).
    ENABLE_DEV_LOGIN: z
      .stringbool()
      .optional()
      .default(false)
      .transform((enabled) => enabled && !devLoginBlocked),
    TALLY_API_KEY: z.string().min(1).optional(),
    TALLY_ORGANIZATION_ID: z.string().min(1).optional(),
    // Optional. Referrals otherwise derive their signing secret from TALLY_API_KEY.
    TALLY_REFERRALS_WEBHOOK_SECRET: z.string().min(1).optional(),

    // --- Newsletter app -----------------------------------------------------
    // All optional so the rest of Cockpit boots without newsletter credentials.
    // `NEWSLETTER_SEND_MODE` defaults to "sandbox": every Resend send is
    // intercepted and logged instead of dispatched. Switching to "live" is a
    // deliberate act, never a default.
    NEWSLETTER_SEND_MODE: z
      .enum(["sandbox", "live"])
      .optional()
      .default("sandbox"),
    NEWSLETTER_STORAGE: z.enum(["local", "blob"]).optional().default("local"),
    RESEND_API_KEY: optionalSecret,
    RESEND_NEWSLETTER_SEGMENT_ID: optionalSecret,
    RESEND_NEWSLETTER_TOPIC_ID: optionalSecret,
    BLOB_READ_WRITE_TOKEN: optionalSecret,
    OPENAI_API_KEY: optionalSecret,
    OPENAI_MODEL: z.string().min(1).optional().default("gpt-5.6-luna"),
  },
  client: {
    NEXT_PUBLIC_COCKPIT_URL: z.url(),
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: z.string().min(1).optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.url().optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_COCKPIT_URL: process.env.NEXT_PUBLIC_COCKPIT_URL,
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN:
      process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_SES_SNS_TOPIC_ARN: process.env.AWS_SES_SNS_TOPIC_ARN,
    GOOGLE_APPLICATION_CREDENTIALS_BASE64:
      process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64,
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
    GOCARDLESS_API_KEY: process.env.GOCARDLESS_API_KEY,
    GOCARDLESS_ENVIRONMENT: process.env.GOCARDLESS_ENVIRONMENT,
    GOCARDLESS_WEBHOOK_SECRET: process.env.GOCARDLESS_WEBHOOK_SECRET,
    GOOGLE_DRIVE_LEGAL_DOCUMENTS_FOLDER_ID:
      process.env.GOOGLE_DRIVE_LEGAL_DOCUMENTS_FOLDER_ID,
    BETTERSTACK_HEARTBEAT_URL_PAYMENT_PROPOSALS:
      process.env.BETTERSTACK_HEARTBEAT_URL_PAYMENT_PROPOSALS,
    BETTERSTACK_HEARTBEAT_URL_GROUP_RECONCILIATION:
      process.env.BETTERSTACK_HEARTBEAT_URL_GROUP_RECONCILIATION,
    DISABLE_EMAIL: process.env.DISABLE_EMAIL,
    DISABLE_GOOGLE_WORKSPACE: process.env.DISABLE_GOOGLE_WORKSPACE,
    DISABLE_SLACK: process.env.DISABLE_SLACK,
    ENABLE_DEV_LOGIN: process.env.ENABLE_DEV_LOGIN,
    TALLY_API_KEY: process.env.TALLY_API_KEY,
    TALLY_ORGANIZATION_ID: process.env.TALLY_ORGANIZATION_ID,
    TALLY_REFERRALS_WEBHOOK_SECRET: process.env.TALLY_REFERRALS_WEBHOOK_SECRET,
    NEWSLETTER_SEND_MODE: process.env.NEWSLETTER_SEND_MODE,
    NEWSLETTER_STORAGE: process.env.NEWSLETTER_STORAGE,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_NEWSLETTER_SEGMENT_ID: process.env.RESEND_NEWSLETTER_SEGMENT_ID,
    RESEND_NEWSLETTER_TOPIC_ID: process.env.RESEND_NEWSLETTER_TOPIC_ID,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  },
});
