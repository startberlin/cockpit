import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import db from "@/db";
import { schema } from "@/db/schema";
import { betterAuthUserAdditionalFields } from "@/db/schema/auth-fields";
import { env } from "@/env";
import { devLogin } from "@/lib/auth-dev-login";

const googleClientId = env.GOOGLE_CLIENT_ID;
const googleClientSecret = env.GOOGLE_CLIENT_SECRET;

/** Whether Google OAuth login is configured (both credentials present). */
export const isGoogleConfigured = Boolean(googleClientId && googleClientSecret);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  user: {
    additionalFields: betterAuthUserAdditionalFields,
  },
  session: {
    cookieCache: { enabled: false },
    additionalFields: {
      impersonatedBy: { type: "string", input: false },
    },
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  onAPIError: {
    errorURL: `${env.NEXT_PUBLIC_COCKPIT_URL}/auth`,
  },
  emailAndPassword: {
    enabled: false,
  },
  // TODO: dev bootstrap — remove `account.accountLinking` once initial admin is signed in.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      // Users are pre-created by admins without going through OAuth, so their
      // emailVerified is false by default. Google is trusted, so skip local check.
      requireLocalEmailVerified: false,
    },
  },
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            enabled: true,
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            disableImplicitSignUp: true,
            prompt: "select_account",
            overrideUserInfoOnSignIn: true,
          },
        }
      : {},
  // nextCookies() must stay last. Dev login is a passwordless bypass — only
  // registered when explicitly enabled and always hard-blocked in production.
  plugins: [...(env.ENABLE_DEV_LOGIN ? [devLogin()] : []), nextCookies()],
});
