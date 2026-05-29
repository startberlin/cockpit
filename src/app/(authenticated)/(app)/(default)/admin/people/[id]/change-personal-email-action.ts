"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { PersonalEmailChangedEmail } from "@/emails/admin/personal-email-changed";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
import { sendEmail } from "@/lib/email";
import { can } from "@/lib/permissions/server";
import { buildSubjectMetadata, track } from "@/lib/posthog-server";

const schema = z.object({
  userId: z.string().min(1),
  personalEmail: z.string().email(),
});

export const changePersonalEmailAction = actionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx }) => {
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

    if (!(await can("user.personal_email.change"))) {
      throw new Error("Not authorized");
    }

    if (parsedInput.personalEmail === existingUser.personalEmail) {
      return { validationError: "New email is the same as the current email." };
    }

    const subjectName =
      `${existingUser.firstName} ${existingUser.lastName}`.trim();

    await writeAuditLog({
      category: "user",
      eventType: "user.personal_email_changed",
      actor: { id: ctx.user.id, name: ctx.user.name },
      subject: { id: existingUser.id, name: subjectName },
      metadata: {
        oldEmail: existingUser.personalEmail,
        newEmail: parsedInput.personalEmail,
      },
      description: existingUser.email ?? "",
    });

    await db
      .update(userTable)
      .set({ personalEmail: parsedInput.personalEmail })
      .where(eq(userTable.id, parsedInput.userId));

    if (existingUser.personalEmail) {
      const oldRecipients = [
        existingUser.personalEmail,
        existingUser.email,
      ].filter(Boolean) as string[];
      await sendEmail({
        from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
        to: oldRecipients,
        subject: "Your personal email address has been changed",
        react: PersonalEmailChangedEmail({
          firstName: existingUser.firstName,
          newEmail: parsedInput.personalEmail,
          isSecurityNotice: true,
        }),
        emailType: "personal-email-changed",
      });
    }

    const newRecipients = [
      parsedInput.personalEmail,
      existingUser.email,
    ].filter(Boolean) as string[];
    await sendEmail({
      from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
      to: newRecipients,
      subject: "Your personal email address has been updated",
      react: PersonalEmailChangedEmail({
        firstName: existingUser.firstName,
        newEmail: parsedInput.personalEmail,
        isSecurityNotice: false,
      }),
      emailType: "personal-email-changed",
    });

    revalidatePath(`/admin/people/${parsedInput.userId}`);

    after(() =>
      track({
        distinctId: existingUser.id,
        event: "admin_user_personal_email_changed",
        properties: {
          actor_id: ctx.user.id,
          ...buildSubjectMetadata(existingUser),
        },
      }),
    );
  });
