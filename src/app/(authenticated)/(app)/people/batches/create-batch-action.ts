"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import db from "@/db";
import { batch } from "@/db/schema/batch";
import { actionClient } from "@/lib/action-client";
import { can } from "@/lib/permissions/server";
import { createBatchSchema } from "./create-batch-schema";

export const createBatchAction = actionClient
  .inputSchema(createBatchSchema)
  .action(async ({ parsedInput }) => {
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

    revalidatePath("/people/batches");
    revalidatePath("/people");

    return { number: parsedInput.number };
  });
