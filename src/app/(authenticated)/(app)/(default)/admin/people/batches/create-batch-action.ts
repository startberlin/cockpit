"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import db from "@/db";
import { batch } from "@/db/schema/batch";
import { actionClient } from "@/lib/action-client";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";
import { track } from "@/lib/posthog-server";
import { createBatchSchema } from "./create-batch-schema";

export const createBatchAction = actionClient
  .inputSchema(createBatchSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await can("batches.manage"))) {
      throw new Error("You are not authorized to manage batches.");
    }

    const existing = await db
      .select({ number: batch.number })
      .from(batch)
      .where(eq(batch.number, parsedInput.number))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(
        `Batch #${parsedInput.number} already exists. Please use a different number.`,
      );
    }

    await db
      .insert(batch)
      .values({ number: parsedInput.number, startDate: parsedInput.startDate });

    revalidatePath("/admin/people/batches");
    revalidatePath("/admin/people");

    try {
      await inngest.send({
        name: events.batchCreated.name,
        data: { batchNumber: parsedInput.number },
      });
    } catch (err) {
      console.error(
        `[create-batch] Failed to send batchCreated event for batch #${parsedInput.number}`,
        err,
      );
    }

    after(() =>
      track({
        distinctId: ctx.user.id,
        event: "admin_batch_created",
        properties: {
          actor_id: ctx.user.id,
          batch_number: parsedInput.number,
        },
      }),
    );

    return { number: parsedInput.number };
  });
