"use server";

import { z } from "zod";
import {
  checkGoogleEmailPrefixAvailability,
  checkSlugAvailability,
} from "@/db/groups";
import { actionClient } from "@/lib/action-client";
import { googleGroupExists } from "@/lib/google-workspace/directory";
import { isSystemGroupSlug } from "@/lib/groups/system-groups";
import { can } from "@/lib/permissions/server";

const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/);

const emailPrefixSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/);

export const checkSlugAction = actionClient
  .inputSchema(z.object({ slug: slugSchema }))
  .action(async ({ parsedInput }) => {
    if (!(await can("groups.create"))) {
      throw new Error("Not authorized.");
    }

    const { slug } = parsedInput;

    if (isSystemGroupSlug(slug, []) || slug.startsWith("batch-")) {
      return { available: false, reason: "reserved" as const };
    }

    const available = await checkSlugAvailability(slug);
    return { available, reason: available ? null : ("taken" as const) };
  });

export const checkEmailPrefixAction = actionClient
  .inputSchema(z.object({ prefix: emailPrefixSchema }))
  .action(async ({ parsedInput }) => {
    if (!(await can("groups.create"))) {
      throw new Error("Not authorized.");
    }

    const { prefix } = parsedInput;
    const groupEmail = `${prefix}@start-berlin.com`;

    const [dbAvailable, googleExists] = await Promise.all([
      checkGoogleEmailPrefixAvailability(prefix),
      googleGroupExists(groupEmail),
    ]);

    const available = dbAvailable && !googleExists;
    return { available, prefix };
  });
