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
  session: {
    // Signed cookie cache lets middleware and server components validate the
    // session without a Postgres round-trip on every request. Revocations
    // (sign-out, board-kick, impersonate-stop, membership transitions) take
    // up to `maxAge` to propagate; for sensitive checks call
    // `auth.api.getSession({ disableCookieCache: true })`.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
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
  socialProviders: {
    google: {
      enabled: true,
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      disableImplicitSignUp: true,
      prompt: "select_account",
      overrideUserInfoOnSignIn: true,
    },
  },
  plugins: [nextCookies()],
});
