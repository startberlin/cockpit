"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getEligibleUsersForPositions,
  getPositionAssignments,
  type PositionHolder,
  replacePositionAssignments,
} from "@/db/authority";
import type { Department } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";
import { DEPARTMENT_IDS, DEPARTMENT_NAMES } from "@/lib/departments";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";

const schema = z.object({
  president: z.string().nullable(),
  vice_president: z.string().nullable(),
  head_of_finance: z.string().nullable(),
  departmentHeads: z.record(z.enum(DEPARTMENT_IDS), z.string().nullable()),
});

function formatPositionLabel(
  position:
    | "president"
    | "vice_president"
    | "head_of_finance"
    | "department_head",
  department?: Department,
): string {
  if (position === "department_head" && department) {
    return `Head of ${DEPARTMENT_NAMES[department]}`;
  }
  const labels: Record<string, string> = {
    president: "President",
    vice_president: "Vice President",
    head_of_finance: "Head of Finance",
  };
  return labels[position] ?? position;
}

export const updatePositionsAction = actionClient
  .inputSchema(schema)
  .action(async ({ parsedInput }) => {
    if (!(await can("users.manage_authority"))) {
      throw new Error("You are not authorized to update positions.");
    }

    const [previous, eligibleUsers] = await Promise.all([
      getPositionAssignments(),
      getEligibleUsersForPositions(),
    ]);

    const userMap = new Map(eligibleUsers.map((u) => [u.userId, u]));

    function holderFromId(id: string | null): PositionHolder | null {
      if (!id) return null;
      return userMap.get(id) ?? null;
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
      ) as Partial<Record<Department, PositionHolder>>,
    };

    await replacePositionAssignments(next);

    revalidatePath("/admin/settings");
    revalidatePath("/admin/people/directory", "layout");

    const notificationEvents: Parameters<typeof inngest.send>[0] = [];

    const globalPositions = [
      "president",
      "vice_president",
      "head_of_finance",
    ] as const;

    for (const pos of globalPositions) {
      const oldHolder = previous[pos];
      const newHolder = next[pos];

      if (oldHolder?.userId === newHolder?.userId) continue;

      const label = formatPositionLabel(pos);

      if (oldHolder) {
        notificationEvents.push({
          name: events.positionAssignmentDeleted.name,
          data: {
            email: oldHolder.email,
            firstName: oldHolder.firstName,
            positionLabel: label,
          },
        });
      }

      if (newHolder) {
        notificationEvents.push({
          name: events.positionAssignmentCreated.name,
          data: {
            email: newHolder.email,
            firstName: newHolder.firstName,
            positionLabel: label,
          },
        });
      }
    }

    for (const dept of DEPARTMENT_IDS) {
      const oldHolder = previous.departmentHeads[dept] ?? null;
      const newHolder = next.departmentHeads[dept] ?? null;

      if (oldHolder?.userId === newHolder?.userId) continue;

      const label = formatPositionLabel("department_head", dept);

      if (oldHolder) {
        notificationEvents.push({
          name: events.positionAssignmentDeleted.name,
          data: {
            email: oldHolder.email,
            firstName: oldHolder.firstName,
            positionLabel: label,
          },
        });
      }

      if (newHolder) {
        notificationEvents.push({
          name: events.positionAssignmentCreated.name,
          data: {
            email: newHolder.email,
            firstName: newHolder.firstName,
            positionLabel: label,
          },
        });
      }
    }

    if (notificationEvents.length > 0) {
      await inngest.send(notificationEvents);
    }
  });
