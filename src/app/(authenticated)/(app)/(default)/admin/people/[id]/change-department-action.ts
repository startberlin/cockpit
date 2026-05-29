"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import db from "@/db";
import { getPositionAssignments } from "@/db/authority";
import { user as userTable } from "@/db/schema/auth";
import { DepartmentChangedDeptHeadEmail } from "@/emails/admin/department-changed-dept-head";
import { DepartmentChangedMemberEmail } from "@/emails/admin/department-changed-member";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
import { DEPARTMENT_IDS } from "@/lib/departments";
import { sendEmail } from "@/lib/email";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";
import { buildSubjectMetadata, track } from "@/lib/posthog-server";

const schema = z.object({
  userId: z.string().min(1),
  department: z.enum(DEPARTMENT_IDS),
});

export const changeDepartmentAction = actionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx }) => {
    const [existingUser] = await db
      .select({
        id: userTable.id,
        email: userTable.email,
        personalEmail: userTable.personalEmail,
        firstName: userTable.firstName,
        lastName: userTable.lastName,
        department: userTable.department,
        status: userTable.status,
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

    if (
      !(await can("user.department.change", {
        department: existingUser.department,
      }))
    ) {
      throw new Error("Not authorized");
    }

    const subjectName =
      `${existingUser.firstName} ${existingUser.lastName}`.trim();

    await writeAuditLog({
      category: "user",
      eventType: "user.department_changed",
      actor: { id: ctx.user.id, name: ctx.user.name },
      subject: { id: existingUser.id, name: subjectName },
      metadata: {
        oldDepartment: existingUser.department,
        newDepartment: parsedInput.department,
      },
      description: `${existingUser.email}`,
    });

    const whereClause =
      existingUser.department === null
        ? and(
            eq(userTable.id, parsedInput.userId),
            isNull(userTable.department),
          )
        : and(
            eq(userTable.id, parsedInput.userId),
            eq(userTable.department, existingUser.department),
          );

    const result = await db
      .update(userTable)
      .set({
        department: parsedInput.department as typeof existingUser.department,
      })
      .where(whereClause)
      .returning({ id: userTable.id });

    if (result.length === 0) {
      throw new Error(
        "Department was changed concurrently. Please reload and try again.",
      );
    }

    try {
      await inngest.send({
        name: events.cockpitUserUpdated.name,
        data: { id: existingUser.id },
      });
      await inngest.send({
        name: events.userSystemGroupsSync.name,
        data: {
          userId: existingUser.id,
          before: {
            status: existingUser.status,
            department: existingUser.department,
            batchNumber: existingUser.batchNumber ?? null,
          },
          after: {
            status: existingUser.status,
            department:
              parsedInput.department as typeof existingUser.department,
            batchNumber: existingUser.batchNumber ?? null,
          },
        },
      });
    } catch (err) {
      console.error(
        `[change-department] Inngest event dispatch failed (userId=${existingUser.id}):`,
        err,
      );
    }

    const positions = await getPositionAssignments();
    const oldHead = existingUser.department
      ? (positions.departmentHeads[existingUser.department] ?? null)
      : null;
    const newHead =
      positions.departmentHeads[
        parsedInput.department as keyof typeof positions.departmentHeads
      ] ?? null;

    if (oldHead !== null && oldHead.email === null) {
      console.warn(
        `[change-department] Old department head has no email (userId=${oldHead.userId}, department=${existingUser.department}) — skipping notification`,
      );
    }
    if (newHead !== null && newHead.email === null) {
      console.warn(
        `[change-department] New department head has no email (userId=${newHead.userId}, department=${parsedInput.department}) — skipping notification`,
      );
    }

    const memberName = subjectName;
    const memberEmail = existingUser.email ?? "";

    const userEmailRecipients = [
      existingUser.personalEmail,
      existingUser.email,
    ].filter((addr): addr is string => Boolean(addr));

    try {
      if (userEmailRecipients.length > 0) {
        await sendEmail({
          from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
          to: userEmailRecipients,
          subject: "Your department has been updated",
          react: DepartmentChangedMemberEmail({
            firstName: existingUser.firstName,
            oldDepartment: existingUser.department,
            newDepartment: parsedInput.department,
          }),
        });
      }
    } catch (err) {
      console.error(
        `[change-department] Failed to send member notification email (userId=${existingUser.id}):`,
        err,
      );
    }

    const sameHead =
      oldHead !== null && newHead !== null && oldHead.userId === newHead.userId;

    if (sameHead && oldHead !== null && oldHead.email !== null) {
      // Old and new head are the same person — send one "joined" email for the new department
      try {
        await sendEmail({
          from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
          to: oldHead.email,
          subject: `${memberName} has joined your department`,
          react: DepartmentChangedDeptHeadEmail({
            firstName: oldHead.firstName,
            memberName,
            memberEmail,
            department: parsedInput.department,
            direction: "joined",
          }),
        });
      } catch (err) {
        console.error(
          `[change-department] Failed to send dept head (same head) notification (userId=${oldHead.userId}):`,
          err,
        );
      }
    } else {
      if (oldHead !== null && oldHead.email !== null) {
        try {
          await sendEmail({
            from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
            to: oldHead.email,
            subject: `${memberName} has left your department`,
            react: DepartmentChangedDeptHeadEmail({
              firstName: oldHead.firstName,
              memberName,
              memberEmail,
              department: existingUser.department ?? parsedInput.department,
              direction: "left",
            }),
          });
        } catch (err) {
          console.error(
            `[change-department] Failed to send old dept head notification (userId=${oldHead.userId}):`,
            err,
          );
        }
      }

      if (newHead !== null && newHead.email !== null) {
        try {
          await sendEmail({
            from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
            to: newHead.email,
            subject: `${memberName} has joined your department`,
            react: DepartmentChangedDeptHeadEmail({
              firstName: newHead.firstName,
              memberName,
              memberEmail,
              department: parsedInput.department,
              direction: "joined",
            }),
          });
        } catch (err) {
          console.error(
            `[change-department] Failed to send new dept head notification (userId=${newHead.userId}):`,
            err,
          );
        }
      }
    }

    revalidatePath("/admin/people/" + parsedInput.userId);

    after(() =>
      track({
        distinctId: existingUser.id,
        event: "admin_user_department_changed",
        properties: {
          actor_id: ctx.user.id,
          old_department: existingUser.department,
          new_department: parsedInput.department,
          ...buildSubjectMetadata(existingUser),
        },
      }),
    );
  });
