"use server";

import { z } from "zod";
import { checkSlugAvailability } from "@/db/groups";
import { actionClient } from "@/lib/action-client";

const checkSlugSchema = z.object({
  slug: z.string().min(1),
});

export const checkSlugAction = actionClient
  .inputSchema(checkSlugSchema)
  .action(async ({ parsedInput }) => {
    const isAvailable = await checkSlugAvailability(parsedInput.slug);
    return { available: isAvailable };
  });
