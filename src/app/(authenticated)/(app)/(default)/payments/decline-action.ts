"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { advancePaymentStatus, getPaymentById } from "@/db/membership-payments";
import { actionClient } from "@/lib/action-client";
import { can } from "@/lib/permissions/server";

export const declineAction = actionClient
  .inputSchema(
    z.object({
      id: z.string(),
      reason: z.string().min(1, "Reason is required"),
    }),
  )
  .action(async ({ parsedInput }) => {
    if (!(await can("payments.manage"))) {
      throw new Error("Not authorized.");
    }

    const row = await getPaymentById(parsedInput.id);
    if (!row) {
      throw new Error("Payment not found.");
    }

    // advancePaymentStatus is the atomic gate — returns false if another
    // request already processed this row.
    const declined = await advancePaymentStatus(
      row.id,
      "proposed",
      "declined",
      {
        declineReason: parsedInput.reason,
      },
    );

    if (!declined) {
      return { alreadyProcessed: true };
    }

    revalidatePath("/payments");

    return { alreadyProcessed: false };
  });
