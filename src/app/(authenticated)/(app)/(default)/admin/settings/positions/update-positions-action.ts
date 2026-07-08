"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import db from "@/db";
import {
  getEligibleUsersForPositions,
  getPositionAssignments,
  POSITIONS_LOCK_KEY,
  type PositionHolder,
  replacePositionAssignments,
} from "@/db/authority";
import type { Department } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
import { DEPARTMENT_IDS, DEPARTMENT_NAMES } from "@/lib/departments";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";

const schema = z.object({
  president: z.string().nullable(),
  vice_president: z.string().nullable(),
  head_of_finance: z.string().nullable(),
  departmentHeads: z.record(z.enum(DEPARTMENT_IDS), z.string().nullable()),
  departmentCoLeads: z.record(z.enum(DEPARTMENT_IDS), z.array(z.string())),
});

export const updatePositionsAction = actionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await can("settings.positions.manage"))) {
      throw new Error("You are not authorized to update positions.");
    }

    // Eligible users are stable reference data — no lock needed here
    const eligibleUsers = await getEligibleUsersForPositions();
    const userMap = new Map(eligibleUsers.map((u) => [u.userId, u]));

    function holderFromId(id: string | null): PositionHolder | null {
      if (!id) return null;
      const holder = userMap.get(id);
      if (!holder)
        throw new Error(`User ${id} is not eligible for position assignment`);
      return holder;
    }

    const next = {
      president: holderFromId(parsedInput.president),
      vice_president: holderFromId(parsedInput.vice_president),
      head_of_finance: holderFromId(parsedInput.head_of_finance),
      departmentHeads: Object.fromEntries(
        Object.entries(parsedInput.departmentHeads).map(([dept, userId]) => [
          dept,
          holderFromId(userId),
        ]),
      ) as Partial<Record<Department, PositionHolder | null>>,
      departmentCoLeads: Object.fromEntries(
        Object.entries(parsedInput.departmentCoLeads).map(([dept, userIds]) => [
          dept,
          // De-duplicate co-leads while resolving each to an eligible holder.
          [...new Set(userIds)].map((id) => {
            const holder = holderFromId(id);
            if (!holder) {
              throw new Error(`User ${id} is not eligible for position`);
            }
            return holder;
          }),
        ]),
      ) as Partial<Record<Department, PositionHolder[]>>,
    };

    // A member cannot be both head and co-lead of the same department.
    for (const dept of DEPARTMENT_IDS) {
      const head = next.departmentHeads[dept] ?? null;
      const coLeads = next.departmentCoLeads[dept] ?? [];
      if (head && coLeads.some((c) => c.userId === head.userId)) {
        throw new Error(
          `A member cannot be both head and co-lead of ${DEPARTMENT_NAMES[dept]}.`,
        );
      }
    }

    // Lock first so previous is read under the same lock that guards the write.
    // inngest.send is called after commit so the transaction holds no HTTP latency.
    const { notificationEvents, auditPositionChanges } = await db.transaction(
      async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${POSITIONS_LOCK_KEY})`,
        );
        const previous = await getPositionAssignments(tx);

        const pendingEvents: Parameters<typeof inngest.send>[0] = [];
        const positionChanges: Array<{
          eventType:
            | "authority.position_assigned"
            | "authority.position_removed";
          subjectId: string;
          subjectName: string;
          position: string;
        }> = [];

        const globalPositions = [
          "president",
          "vice_president",
          "head_of_finance",
        ] as const;

        for (const pos of globalPositions) {
          const oldHolder = previous[pos];
          const newHolder = next[pos];

          if (oldHolder?.userId === newHolder?.userId) continue;

          const positionLabels = {
            president: "President",
            vice_president: "Vice President",
            head_of_finance: "Head of Finance",
          } as const;

          const label = positionLabels[pos];

          if (oldHolder) {
            pendingEvents.push({
              id: `pos-removed-v1-${oldHolder.userId}-${pos}`,
              name: events.positionAssignmentDeleted.name,
              data: {
                email: oldHolder.email,
                firstName: oldHolder.firstName,
                positionLabel: label,
              },
            });
            positionChanges.push({
              eventType: "authority.position_removed",
              subjectId: oldHolder.userId,
              subjectName:
                `${oldHolder.firstName} ${oldHolder.lastName ?? ""}`.trim(),
              position: label,
            });
          }

          if (newHolder) {
            pendingEvents.push({
              id: `pos-assigned-v1-${newHolder.userId}-${pos}`,
              name: events.positionAssignmentCreated.name,
              data: {
                email: newHolder.email,
                firstName: newHolder.firstName,
                positionLabel: label,
              },
            });
            positionChanges.push({
              eventType: "authority.position_assigned",
              subjectId: newHolder.userId,
              subjectName:
                `${newHolder.firstName} ${newHolder.lastName ?? ""}`.trim(),
              position: label,
            });
          }
        }

        for (const dept of DEPARTMENT_IDS) {
          const oldHolder = previous.departmentHeads[dept] ?? null;
          const newHolder = next.departmentHeads[dept] ?? null;

          if (oldHolder?.userId === newHolder?.userId) continue;

          if (oldHolder) {
            pendingEvents.push({
              id: `pos-removed-v1-${oldHolder.userId}-department_head-${dept}`,
              name: events.positionAssignmentDeleted.name,
              data: {
                email: oldHolder.email,
                firstName: oldHolder.firstName,
                positionLabel: `Head of ${DEPARTMENT_NAMES[dept]}`,
              },
            });
            positionChanges.push({
              eventType: "authority.position_removed",
              subjectId: oldHolder.userId,
              subjectName:
                `${oldHolder.firstName} ${oldHolder.lastName ?? ""}`.trim(),
              position: `Head of ${DEPARTMENT_NAMES[dept]}`,
            });
          }

          if (newHolder) {
            pendingEvents.push({
              id: `pos-assigned-v1-${newHolder.userId}-department_head-${dept}`,
              name: events.positionAssignmentCreated.name,
              data: {
                email: newHolder.email,
                firstName: newHolder.firstName,
                positionLabel: `Head of ${DEPARTMENT_NAMES[dept]}`,
              },
            });
            positionChanges.push({
              eventType: "authority.position_assigned",
              subjectId: newHolder.userId,
              subjectName:
                `${newHolder.firstName} ${newHolder.lastName ?? ""}`.trim(),
              position: `Head of ${DEPARTMENT_NAMES[dept]}`,
            });
          }
        }

        for (const dept of DEPARTMENT_IDS) {
          const label = `Co-Lead of ${DEPARTMENT_NAMES[dept]}`;
          const oldCoLeads = previous.departmentCoLeads[dept] ?? [];
          const newCoLeads = next.departmentCoLeads[dept] ?? [];
          const oldById = new Map(oldCoLeads.map((c) => [c.userId, c]));
          const newById = new Map(newCoLeads.map((c) => [c.userId, c]));

          for (const [userId, holder] of oldById) {
            if (newById.has(userId)) continue;
            pendingEvents.push({
              id: `pos-removed-v1-${holder.userId}-department_co_lead-${dept}`,
              name: events.positionAssignmentDeleted.name,
              data: {
                email: holder.email,
                firstName: holder.firstName,
                positionLabel: label,
              },
            });
            positionChanges.push({
              eventType: "authority.position_removed",
              subjectId: holder.userId,
              subjectName:
                `${holder.firstName} ${holder.lastName ?? ""}`.trim(),
              position: label,
            });
          }

          for (const [userId, holder] of newById) {
            if (oldById.has(userId)) continue;
            pendingEvents.push({
              id: `pos-assigned-v1-${holder.userId}-department_co_lead-${dept}`,
              name: events.positionAssignmentCreated.name,
              data: {
                email: holder.email,
                firstName: holder.firstName,
                positionLabel: label,
              },
            });
            positionChanges.push({
              eventType: "authority.position_assigned",
              subjectId: holder.userId,
              subjectName:
                `${holder.firstName} ${holder.lastName ?? ""}`.trim(),
              position: label,
            });
          }
        }

        await replacePositionAssignments(next, tx);

        return {
          notificationEvents: pendingEvents,
          auditPositionChanges: positionChanges,
        };
      },
    );

    revalidatePath("/admin/settings/positions");
    revalidatePath("/admin/people", "layout");

    for (const change of auditPositionChanges) {
      await writeAuditLog({
        category: "authority",
        eventType: change.eventType,
        actor: { id: ctx.user.id, name: ctx.user.name },
        subject: { id: change.subjectId, name: change.subjectName },
        metadata: { position: change.position },
        description: change.position,
      });
    }

    if (notificationEvents.length > 0) {
      try {
        await inngest.send(notificationEvents);
      } catch (err) {
        console.error(
          "[update-positions] Failed to send position notification events",
          err,
        );
      }
    }

    const affectedUserIds = new Set(
      auditPositionChanges.map((c) => c.subjectId),
    );
    if (affectedUserIds.size > 0) {
      await inngest.send(
        [...affectedUserIds].map((userId) => ({
          name: events.positionsSystemGroupsSync.name,
          data: { userId },
        })),
      );
    }
  });
