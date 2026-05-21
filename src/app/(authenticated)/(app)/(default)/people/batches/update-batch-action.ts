"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import db from "@/db";
import { batch } from "@/db/schema/batch";
import { actionClient } from "@/lib/action-client";
import { can } from "@/lib/permissions/server";
import { updateBatchSchema } from "./update-batch-schema";

export const updateBatchAction = actionClient
  .inputSchema(updateBatchSchema)
  .action(async ({ parsedInput }) => {
    if (!(await can("batches.manage"))) {
      throw new Error("You are not authorized to manage batches.");
    }

    await db
      .update(batch)
      .set({ startDate: parsedInput.startDate })
      .where(eq(batch.number, parsedInput.number));

    revalidatePath("/people/batches");
    revalidatePath("/people");
  });
