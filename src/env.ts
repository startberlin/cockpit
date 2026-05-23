import { createEnv } from "@t3-oss/env-nextjs";
import z from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.url().optional().default("http://localhost:3000"),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    AWS_REGION: z.string().min(1),
    AWS_ACCESS_KEY_ID: z.string().min(1),
    AWS_SECRET_ACCESS_KEY: z.string().min(1),
    AWS_SES_SNS_TOPIC_ARN: z.string().min(1),
    GOOGLE_APPLICATION_CREDENTIALS_BASE64: z.string().min(1),
    SLACK_BOT_TOKEN: z.string().min(1).optional(),
    GOCARDLESS_API_KEY: z.string().min(1).optional(),
    GOCARDLESS_ENVIRONMENT: z
      .enum(["live", "sandbox"])
      .optional()
      .default("live"),
    GOCARDLESS_WEBHOOK_SECRET: z.string().min(1).optional(),
    GOOGLE_DRIVE_LEGAL_DOCUMENTS_FOLDER_ID: z.string().min(1),
    BETTERSTACK_HEARTBEAT_URL: z.url().optional(),
    DISABLE_EMAIL: z.stringbool().optional().default(false),
    DISABLE_GOOGLE_WORKSPACE: z.stringbool().optional().default(false),
    DISABLE_SLACK: z.stringbool().optional().default(false),
    TALLY_API_KEY: z.string().min(1).optional(),
    TALLY_ORGANIZATION_ID: z.string().min(1).optional(),
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
    BETTERSTACK_HEARTBEAT_URL: process.env.BETTERSTACK_HEARTBEAT_URL,
    DISABLE_EMAIL: process.env.DISABLE_EMAIL,
    DISABLE_GOOGLE_WORKSPACE: process.env.DISABLE_GOOGLE_WORKSPACE,
    DISABLE_SLACK: process.env.DISABLE_SLACK,
    TALLY_API_KEY: process.env.TALLY_API_KEY,
    TALLY_ORGANIZATION_ID: process.env.TALLY_ORGANIZATION_ID,
  },
});
