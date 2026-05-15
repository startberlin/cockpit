import { randomInt } from "node:crypto";
import { Common, google } from "googleapis";
import { NonRetriableError } from "inngest";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import SignInInstructionsEmail from "@/emails/signin-instructions";
import StartCockpitEnabledEmail from "@/emails/start-cockpit-enabled";
import { sendEmail } from "@/lib/email";
import { createGoogleAuth } from "@/lib/google-auth";
import { newId } from "@/lib/id";
import { events, inngest } from "@/lib/inngest";

function generateRandomPassword(length = 15) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "@$!%*#?&";
  const all = upper + lower + digits + special;

  // Guarantee at least one character from each class.
  const required = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
    special[randomInt(special.length)],
  ];

  const rest = Array.from(
    { length: length - required.length },
    () => all[randomInt(all.length)],
  );

  // Fisher-Yates shuffle so the required chars aren't always first.
  const chars = [...required, ...rest];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
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

      await sendEmail({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: personalEmail,
        subject: "Welcome to START Berlin — your sign-in details",
        react: SignInInstructionsEmail({
          firstName,
          companyEmail,
          initialPassword: password,
        }),
      });

      // password intentionally excluded — must not persist in Inngest run history
      return { companyEmail, personalEmail };
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

    await step.run("send-cockpit-access-email", async () => {
      await sendEmail({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: user.companyEmail,
        subject: "Your START Cockpit access is ready",
        react: StartCockpitEnabledEmail({ firstName }),
      });
    });
  },
);
