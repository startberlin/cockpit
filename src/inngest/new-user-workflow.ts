import { GoogleAuth } from "google-auth-library";
import { google } from "googleapis";
import slugify from "slugify";
import db from "@/db";
import type { UserStatus } from "@/db/schema/auth";
import { user as userTable } from "@/db/schema/auth";
import SignInInstructionsEmail from "@/emails/signin-instructions";
import { newId } from "@/lib/id";
import { inngest } from "@/lib/inngest";
import { resend } from "@/lib/resend";

interface EventData {
  firstName: string;
  lastName: string;
  personalEmail: string;
  batchNumber: number;
  departmentId?: string | null;
  status: UserStatus;
}

const SUBJECT = "digital-connection-management@start-berlin.com";

function generateCompanyEmail(firstName: string, lastName: string) {
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
      departmentId,
      status,
    } = event.data as EventData;

    const user = await step.run("create-google-user", async () => {
      const companyEmail = generateCompanyEmail(firstName, lastName);
      const password = generateRandomPassword();

      const auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/admin.directory.user"],
        clientOptions: { subject: SUBJECT },
      });

      const admin = google.admin({ auth, version: "directory_v1" });

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

      return {
        companyEmail,
        personalEmail,
        password,
      };
    });

    await step.run("insert-db-user", async () => {
      await db
        .insert(userTable)
        .values({
          id: newId("user"),
          email: user.companyEmail,
          firstName,
          lastName,
          personalEmail,
          name: `${firstName} ${lastName}`,
          batchNumber,
          departmentId: departmentId ?? null,
          status: status ?? "onboarding",
        })
        .onConflictDoUpdate({
          target: userTable.email,
          set: {
            firstName,
            lastName,
            personalEmail,
            batchNumber,
            departmentId: departmentId ?? null,
            status: (status as UserStatus) ?? "onboarding",
          },
        });
    });

    await step.run("send-welcome-email", async () => {
      await resend.emails.send({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: personalEmail,
        subject: "Welcome to START Berlin!",
        react: SignInInstructionsEmail({
          firstName,
          companyEmail: user.companyEmail,
          initialPassword: user.password,
        }),
      });
    });
  },
);
