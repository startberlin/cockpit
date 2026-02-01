import { GoogleAuth } from "google-auth-library";
import { Common, google } from "googleapis";
import slugify from "slugify";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import SignInInstructionsEmail from "@/emails/signin-instructions";
import { newId } from "@/lib/id";
import { inngest } from "@/lib/inngest";
import { resend } from "@/lib/resend";

const SUBJECT = "digital-connection-management@start-berlin.com";

// Join multi-part names with hyphens, transliterate special chars, lowercase, keep only [a-z0-9.-]
// For details: https://github.com/simov/slugify#custom-replacements
const customReplacements = [
  ["ä", "ae"],
  ["ö", "oe"],
  ["ü", "ue"],
  ["ß", "ss"],
  ["æ", "ae"],
  ["ø", "oe"],
  ["å", "aa"],
  ["Ä", "ae"],
  ["Ö", "oe"],
  ["Ü", "ue"],
  ["Æ", "ae"],
  ["Ø", "oe"],
  ["Å", "aa"],
];

function generateCompanyEmail(firstName: string, lastName: string) {
  const slugOptions = {
    lower: true,
    strict: true,
    customReplacements,
  } as const;

  const firstSlug = slugify(firstName.replace(/\s+/g, "-"), slugOptions);
  const lastSlug = slugify(lastName.replace(/\s+/g, "-"), slugOptions);

  return `${firstSlug}.${lastSlug}@start-berlin.com`;
}

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
  { id: "onboard-new-user", idempotency: "event.data.personalEmail" },
  { event: "user.created" },
  async ({ event, step }) => {
    const {
      firstName,
      lastName,
      personalEmail,
      batchNumber,
      department,
      status,
    } = event.data;

    const user = await step.run("create-google-user", async () => {
      const companyEmail = generateCompanyEmail(firstName, lastName);
      const password = generateRandomPassword();

      const auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/admin.directory.user"],
        clientOptions: { subject: SUBJECT },
      });

      const admin = google.admin({ auth, version: "directory_v1" });

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
          return {
            companyEmail,
            personalEmail: null,
            password: null,
          };
        }

        throw error;
      }

      return {
        companyEmail,
        personalEmail,
        password,
      };
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
          batchNumber,
          department: departmentValue,
          status: status ?? "onboarding",
        })
        .onConflictDoUpdate({
          target: userTable.email,
          set: {
            firstName,
            lastName,
            personalEmail,
            batchNumber,
            department: departmentValue,
            status: status ?? "onboarding",
          },
        })
        .returning({ id: userTable.id });
    });

    if (user.password && user.personalEmail) {
      await step.run("send-welcome-email", async () => {
        return await resend.emails.send({
          from: "START Berlin <notifications@emails.start-berlin.com>",
          to: personalEmail,
          subject: "Welcome to START Berlin!",
          react: SignInInstructionsEmail({
            firstName,
            companyEmail: user.companyEmail,
            initialPassword: user.password,
          }),
        });
      });
    }
  },
);
