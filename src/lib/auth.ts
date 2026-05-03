import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import db from "@/db";
import { schema } from "@/db/schema";
import { betterAuthUserAdditionalFields } from "@/db/schema/auth-fields";
import { env } from "@/env";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  user: {
    additionalFields: betterAuthUserAdditionalFields,
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  onAPIError: {
    errorURL: `${env.NEXT_PUBLIC_COCKPIT_URL}/auth`,
  },
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    google: {
      enabled: true,
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      disableImplicitSignUp: true,
      prompt: "select_account",
    },
  },
  plugins: [nextCookies()],
});
