import { Common, google } from "googleapis";
import { NonRetriableError } from "inngest";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import SignInInstructionsEmail from "@/emails/signin-instructions";
import StartCockpitEnabledEmail from "@/emails/start-cockpit-enabled";
import { createGoogleAuth } from "@/lib/google-auth";
import { newId } from "@/lib/id";
import { events, inngest } from "@/lib/inngest";
import { resend } from "@/lib/resend";

function generateRandomPassword(length = 15) {
  // Simple secure password generator with all required charsets.
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@$!%*#?&";
  let res = "";
  for (let i = 0; i < length; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

export const onboardNewUserWorkflow = inngest.createFunction(
  {
    id: "onboard-new-user",
    idempotency: "event.data.personalEmail",
    triggers: [{ event: events.userCreated }],
  },
  async ({ event, step }) => {
    const {
      firstName,
      lastName,
      personalEmail,
      companyEmail,
      batchNumber,
      department,
      status,
    } = event.data;

    const user = await step.run("create-google-user", async () => {
      const password = generateRandomPassword();

      const auth = createGoogleAuth(
        "https://www.googleapis.com/auth/admin.directory.user",
      );

      const admin = google.admin({
        auth,
        version: "directory_v1",
      });

      try {
        const res = await admin.users.insert({
          requestBody: {
            name: { givenName: firstName, familyName: lastName },
            primaryEmail: companyEmail,
            recoveryEmail: personalEmail,
            password,
            changePasswordAtNextLogin: true,
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to create user: ${res.statusText}.`);
        }
      } catch (error) {
        if (
          error instanceof Common.GaxiosError &&
          error.message === "Entity already exists."
        ) {
          throw new NonRetriableError(
            `${companyEmail} already exists in Google Workspace. Import that Workspace user instead.`,
          );
        }

        throw error;
      }

      return { companyEmail, personalEmail, password };
    });

    await step.run("insert-db-user", async () => {
      // Convert empty string to null for the database enum
      const departmentValue = department || null;

      return await db
        .insert(userTable)
        .values({
          id: newId("user"),
          email: user.companyEmail,
          firstName,
          lastName,
          personalEmail,
          name: `${firstName} ${lastName}`,
          ...(batchNumber != null ? { batchNumber } : {}),
          department: departmentValue,
          status: status ?? "onboarding",
        })
        .onConflictDoUpdate({
          target: userTable.email,
          set: {
            firstName,
            lastName,
            personalEmail,
            ...(batchNumber != null ? { batchNumber } : {}),
            department: departmentValue,
            status: status ?? "onboarding",
          },
        })
        .returning({ id: userTable.id });
    });

    await step.run("send-signin-instructions", async () => {
      return await resend.emails.send({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: user.personalEmail,
        subject: "Welcome to START Berlin — your sign-in details",
        react: SignInInstructionsEmail({
          firstName,
          companyEmail: user.companyEmail,
          initialPassword: user.password,
        }),
      });
    });

    await step.run("send-cockpit-access-email", async () => {
      return await resend.emails.send({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: user.companyEmail,
        subject: "Your START Cockpit access is ready",
        react: StartCockpitEnabledEmail({ firstName }),
      });
    });
  },
);
