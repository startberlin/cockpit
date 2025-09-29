import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import db from "@/db";
import { schema } from "@/db/schema";
import { env } from "@/env";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  user: {
    additionalFields: {
      firstName: {
        type: "string",
      },
      lastName: {
        type: "string",
      },
    },
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    google: {
      enabled: true,
      prompt: "select_account",
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      mapProfileToUser: async (user) => {
        return {
          firstName: user.given_name,
          lastName: user.family_name,
          name: user.name,
          email: user.email,
          image: user.picture,
          emailVerified: user.email_verified,
        };
      },
    },
  },
  plugins: [nextCookies()],
});
