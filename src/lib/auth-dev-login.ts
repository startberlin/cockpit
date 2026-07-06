import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";

/**
 * DEV-ONLY passwordless login.
 *
 * Adds a `POST /api/auth/sign-in/dev` endpoint that signs in a **pre-existing**
 * user by email with no verification whatsoever — you type an email and, if a
 * matching user row exists, you get a session. This exists so the app can run
 * locally without a real Google OAuth client.
 *
 * SECURITY: This bypasses all identity verification. It is hard-blocked in
 * production (returns 404 regardless of the flag) and should only ever be
 * enabled via ENABLE_DEV_LOGIN in local/dev environments. Never enable it
 * against a production database.
 */
export const devLogin = () =>
  ({
    id: "dev-login",
    endpoints: {
      devSignIn: createAuthEndpoint(
        "/sign-in/dev",
        {
          method: "POST",
          body: z.object({ email: z.string().email() }),
        },
        async (ctx) => {
          // Defense in depth: even if the plugin is somehow registered in
          // production, never allow a passwordless sign-in there.
          if (process.env.NODE_ENV === "production") {
            throw new APIError("NOT_FOUND");
          }

          // Localhost only. Combined with the flag + NODE_ENV block, this keeps
          // the passwordless bypass off the network even if it is ever enabled
          // in a deployed environment. (Host is client-controllable, so this is
          // an extra layer, not the sole guard.)
          const host = (ctx.headers?.get("host") ?? "")
            .replace(/:\d+$/, "")
            .toLowerCase();
          const isLocalhost =
            host === "localhost" ||
            host === "127.0.0.1" ||
            host === "::1" ||
            host === "[::1]";
          if (!isLocalhost) {
            throw new APIError("NOT_FOUND");
          }

          const email = ctx.body.email.toLowerCase();
          const result =
            await ctx.context.internalAdapter.findUserByEmail(email);

          if (!result?.user) {
            throw new APIError("UNAUTHORIZED", {
              message:
                "No user with that email. Create one first: npm run admin:bootstrap -- <email> <firstName> <lastName>",
            });
          }

          const session = await ctx.context.internalAdapter.createSession(
            result.user.id,
          );
          if (!session) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Failed to create session.",
            });
          }

          await setSessionCookie(ctx, { session, user: result.user });

          return ctx.json({ ok: true });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
