"use server";

import { eq } from "drizzle-orm";
import { google } from "googleapis";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import PasswordResetEmail from "@/emails/admin/password-reset";
import { env } from "@/env";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
import { generateRandomPassword } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";
import { createGoogleAuth } from "@/lib/google-auth";
import { can } from "@/lib/permissions/server";
import { buildSubjectMetadata, track } from "@/lib/posthog-server";

const schema = z.object({
  userId: z.string().min(1),
});

export const resetPasswordAction = actionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await can("user.password.reset"))) {
      throw new Error("Not authorized");
    }

    const [existingUser] = await db
      .select({
        id: userTable.id,
        email: userTable.email,
        personalEmail: userTable.personalEmail,
        firstName: userTable.firstName,
        lastName: userTable.lastName,
        status: userTable.status,
        department: userTable.department,
        batchNumber: userTable.batchNumber,
        legalMembershipState: userTable.legalMembershipState,
        memberSinceDate: userTable.memberSinceDate,
      })
      .from(userTable)
      .where(eq(userTable.id, parsedInput.userId))
      .limit(1);

    if (!existingUser) {
      throw new Error("Not authorized");
    }

    if (!existingUser.personalEmail) {
      throw new Error(
        "Cannot reset password: this user has no personal email address on file.",
      );
    }

    await writeAuditLog({
      category: "user",
      eventType: "user.password_reset",
      actor: { id: ctx.user.id, name: ctx.user.name },
      subject: {
        id: existingUser.id,
        name: `${existingUser.firstName} ${existingUser.lastName}`.trim(),
      },
      metadata: {},
      description: existingUser.email ?? "",
    });

    const password = generateRandomPassword();

    if (!env.DISABLE_GOOGLE_WORKSPACE) {
      const auth = createGoogleAuth(
        "https://www.googleapis.com/auth/admin.directory.user",
      );
      const admin = google.admin({ auth, version: "directory_v1" });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(new Error("Password reset timed out. Please try again.")),
          20_000,
        ),
      );

      await Promise.race([
        admin.users.update({
          userKey: existingUser.email!,
          requestBody: { password, changePasswordAtNextLogin: true },
        }),
        timeoutPromise,
      ]);
    }

    const recipients = [existingUser.personalEmail, existingUser.email].filter(
      Boolean,
    ) as string[];

    await sendEmail({
      from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
      to: recipients,
      subject: "Your START Berlin password has been reset",
      react: PasswordResetEmail({
        firstName: existingUser.firstName ?? "",
        companyEmail: existingUser.email ?? "",
        temporaryPassword: password,
      }),
    });

    revalidatePath("/admin/people/" + parsedInput.userId);

    after(() =>
      track({
        distinctId: existingUser.id,
        event: "admin_user_password_reset",
        properties: {
          actor_id: ctx.user.id,
          ...buildSubjectMetadata(existingUser),
        },
      }),
    );
  });
