"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { changeParticipationPause } from "@/db/participation";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";

export const changeParticipationAction = actionClient
  .inputSchema(
    z.object({
      userId: z.string().min(1),
      expectedPausedAt: z.iso.datetime({ precision: 3 }).nullable(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    if (!(await can("user.participation.manage"))) {
      throw new Error("You are not authorized to manage participation.");
    }

    const result = await changeParticipationPause({
      ...parsedInput,
      actor: { id: ctx.user.id, name: ctx.user.name },
    });

    revalidatePath(`/admin/people/${parsedInput.userId}`);
    if (!result) return { outcome: "conflict" } as const;

    revalidatePath("/admin/people");
    revalidatePath("/people");
    revalidatePath("/org-chart");
    revalidatePath("/membership");
    revalidatePath("/admin/groups/[id]", "page");
    revalidatePath("/groups/[id]", "page");

    let notificationQueued = false;
    try {
      await inngest.send({
        id: result.auditId,
        name: events.participationChanged.name,
        data: { auditId: result.auditId },
      });
      notificationQueued = true;
    } catch (error) {
      console.error(
        "Could not queue participation email",
        result.auditId,
        error,
      );
      try {
        await writeAuditLog({
          category: "email",
          eventType: "email.participation_queue_failed",
          subject: result.member,
          metadata: { changeId: result.auditId },
          description: "Could not queue participation emails",
        });
      } catch (auditError) {
        console.error(
          "Could not log participation email queue failure",
          auditError,
        );
      }
    }

    return {
      outcome: "saved",
      paused: result.paused,
      notificationQueued,
    } as const;
  });
