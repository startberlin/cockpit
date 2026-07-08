"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import db from "@/db";
import { getDepartmentLeads, getPositionAssignments } from "@/db/authority";
import { user as userTable } from "@/db/schema";
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
    // Both the head and co-head of a department are notified. The subject is
    // excluded in case they lead the department they're moving between.
    const oldLeads = getDepartmentLeads(
      positions,
      existingUser.department,
      existingUser.id,
    );
    const newLeads = getDepartmentLeads(
      positions,
      parsedInput.department,
      existingUser.id,
    );

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

    // Determine, per lead, whether the member joined or left their department.
    // A lead of the new department always sees a "joined" (this also covers a
    // person who leads both the old and new department). A lead of only the old
    // department sees a "left".
    const newLeadIds = new Set(newLeads.map((l) => l.userId));

    type LeadNotification = {
      holder: (typeof newLeads)[number];
      direction: "joined" | "left";
      department: typeof parsedInput.department;
    };

    const leadNotifications = new Map<string, LeadNotification>();

    for (const lead of newLeads) {
      leadNotifications.set(lead.userId, {
        holder: lead,
        direction: "joined",
        department: parsedInput.department,
      });
    }

    for (const lead of oldLeads) {
      if (newLeadIds.has(lead.userId)) continue;
      leadNotifications.set(lead.userId, {
        holder: lead,
        direction: "left",
        department: (existingUser.department ??
          parsedInput.department) as typeof parsedInput.department,
      });
    }

    for (const {
      holder,
      direction,
      department,
    } of leadNotifications.values()) {
      if (holder.email === null) {
        console.warn(
          `[change-department] Department lead has no email (userId=${holder.userId}) — skipping notification`,
        );
        continue;
      }

      try {
        await sendEmail({
          from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
          to: holder.email,
          subject:
            direction === "joined"
              ? `${memberName} has joined your department`
              : `${memberName} has left your department`,
          react: DepartmentChangedDeptHeadEmail({
            firstName: holder.firstName,
            memberName,
            memberEmail,
            department,
            direction,
          }),
        });
      } catch (err) {
        console.error(
          `[change-department] Failed to send dept lead notification (userId=${holder.userId}):`,
          err,
        );
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
