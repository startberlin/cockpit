"use server";

import { z } from "zod";
import { checkGoogleEmailPrefixAvailability } from "@/db/groups";
import { actionClient } from "@/lib/action-client";
import { googleGroupExists } from "@/lib/google-workspace/directory";

const prefixSchema = z.object({ prefix: z.string().min(1) });

export const checkGoogleEmailPrefixAction = actionClient
  .inputSchema(prefixSchema)
  .action(async ({ parsedInput }) => {
    const { prefix } = parsedInput;
    const email = `${prefix}@start-berlin.com`;
    const [dbAvailable, existsInGoogle] = await Promise.all([
      checkGoogleEmailPrefixAvailability(prefix),
      googleGroupExists(email),
    ]);
    return { available: dbAvailable && !existsInGoogle };
  });
