"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { advancePaymentStatus, getPaymentById } from "@/db/membership-payments";
import { actionClient } from "@/lib/action-client";
import { can } from "@/lib/permissions/server";

export const declineAction = actionClient
  .inputSchema(z.object({ id: z.string() }))
  .action(async ({ parsedInput }) => {
    if (!(await can("payments.manage"))) {
      throw new Error("Not authorized.");
    }

    const row = await getPaymentById(parsedInput.id);
    if (!row) {
      throw new Error("Payment not found.");
    }

    if (row.status !== "proposed") {
      return { alreadyProcessed: true };
    }

    await advancePaymentStatus(row.id, "proposed", "declined");

    revalidatePath("/payments");

    return { alreadyProcessed: false };
  });
