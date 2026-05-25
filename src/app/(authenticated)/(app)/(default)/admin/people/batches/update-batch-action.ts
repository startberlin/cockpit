"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import db from "@/db";
import { batch } from "@/db/schema/batch";
import { actionClient } from "@/lib/action-client";
import { can } from "@/lib/permissions/server";
import { track } from "@/lib/posthog-server";
import { updateBatchSchema } from "./update-batch-schema";

export const updateBatchAction = actionClient
  .inputSchema(updateBatchSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await can("batches.manage"))) {
      throw new Error("You are not authorized to manage batches.");
    }

    const [currentBatch] = await db
      .select({ startDate: batch.startDate })
      .from(batch)
      .where(eq(batch.number, parsedInput.number))
      .limit(1);

    await db
      .update(batch)
      .set({ startDate: parsedInput.startDate })
      .where(eq(batch.number, parsedInput.number));

    revalidatePath("/admin/people/batches");
    revalidatePath("/admin/people");

    const fieldsChanged: string[] = [];
    if (currentBatch && currentBatch.startDate !== parsedInput.startDate) {
      fieldsChanged.push("startDate");
    }

    after(() =>
      track({
        distinctId: ctx.user.id,
        event: "admin_batch_updated",
        properties: {
          actor_id: ctx.user.id,
          batch_number: parsedInput.number,
          fields_changed: fieldsChanged,
        },
      }),
    );
  });
