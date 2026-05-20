"use server";

import { revalidatePath } from "next/cache";
import React from "react";
import { z } from "zod";
import {
  getPositionAssignments,
  type PositionHolder,
  replacePositionAssignments,
} from "@/db/authority";
import type { Department } from "@/db/schema/auth";
import { PositionAssignedEmail } from "@/emails/position-assigned";
import { PositionRemovedEmail } from "@/emails/position-removed";
import { actionClient } from "@/lib/action-client";
import { sendEmail } from "@/lib/email";
import { DEPARTMENTS } from "@/lib/enums";
import { can } from "@/lib/permissions/server";

const departments = [
  "partnerships",
  "operations",
  "community",
  "growth",
  "events",
] as const;

const schema = z.object({
  president: z.string().nullable(),
  vice_president: z.string().nullable(),
  head_of_finance: z.string().nullable(),
  departmentHeads: z.record(z.enum(departments), z.string().nullable()),
  // Map of userId → { id, firstName, lastName, email } for all eligible users
  // passed from client so the action can build PositionHolder objects
  eligibleUsers: z.array(
    z.object({
      userId: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      email: z.string(),
    }),
  ),
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
    return `Head of ${DEPARTMENTS[department]}`;
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

    const userMap = new Map(
      parsedInput.eligibleUsers.map((u) => [u.userId, u]),
    );

    function holderFromId(id: string | null): PositionHolder | null {
      if (!id) return null;
      const u = userMap.get(id);
      return u ?? null;
    }

    const previous = await getPositionAssignments();

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

    // Compute diff and send emails (non-blocking — failures don't roll back saves)
    const emailPromises: Promise<void>[] = [];

    const globalPositions = [
      "president",
      "vice_president",
      "head_of_finance",
    ] as const;

    for (const pos of globalPositions) {
      const oldHolder = previous[pos];
      const newHolder = next[pos];
      const changed = oldHolder?.userId !== newHolder?.userId;

      if (!changed) continue;

      const label = formatPositionLabel(pos);

      if (oldHolder) {
        emailPromises.push(
          sendEmail({
            from: "START Berlin <notifications@cockpit.start-berlin.com>",
            to: oldHolder.email,
            subject: `You've been removed as ${label} at START Berlin`,
            react: React.createElement(PositionRemovedEmail, {
              firstName: oldHolder.firstName,
              positionLabel: label,
            }),
          }).catch((err) =>
            console.error(
              `Failed to send removal email to ${oldHolder.email}:`,
              err,
            ),
          ),
        );
      }

      if (newHolder) {
        emailPromises.push(
          sendEmail({
            from: "START Berlin <notifications@cockpit.start-berlin.com>",
            to: newHolder.email,
            subject: `You've been assigned as ${label} at START Berlin`,
            react: React.createElement(PositionAssignedEmail, {
              firstName: newHolder.firstName,
              positionLabel: label,
            }),
          }).catch((err) =>
            console.error(
              `Failed to send assignment email to ${newHolder.email}:`,
              err,
            ),
          ),
        );
      }
    }

    for (const dept of departments) {
      const oldHolder = previous.departmentHeads[dept] ?? null;
      const newHolder = next.departmentHeads[dept] ?? null;
      const changed = oldHolder?.userId !== newHolder?.userId;

      if (!changed) continue;

      const label = formatPositionLabel("department_head", dept);

      if (oldHolder) {
        emailPromises.push(
          sendEmail({
            from: "START Berlin <notifications@cockpit.start-berlin.com>",
            to: oldHolder.email,
            subject: `You've been removed as ${label} at START Berlin`,
            react: React.createElement(PositionRemovedEmail, {
              firstName: oldHolder.firstName,
              positionLabel: label,
            }),
          }).catch((err) =>
            console.error(
              `Failed to send removal email to ${oldHolder.email}:`,
              err,
            ),
          ),
        );
      }

      if (newHolder) {
        emailPromises.push(
          sendEmail({
            from: "START Berlin <notifications@cockpit.start-berlin.com>",
            to: newHolder.email,
            subject: `You've been assigned as ${label} at START Berlin`,
            react: React.createElement(PositionAssignedEmail, {
              firstName: newHolder.firstName,
              positionLabel: label,
            }),
          }).catch((err) =>
            console.error(
              `Failed to send assignment email to ${newHolder.email}:`,
              err,
            ),
          ),
        );
      }
    }

    await Promise.all(emailPromises);
  });
