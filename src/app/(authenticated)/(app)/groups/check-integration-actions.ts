"use server";

import { z } from "zod";
import {
  checkGoogleEmailPrefixAvailability,
  checkSlackChannelSlugAvailability,
} from "@/db/groups";
import { actionClient } from "@/lib/action-client";
import { googleGroupExists } from "@/lib/google-workspace/directory";
import { slackChannelExists } from "@/lib/slack";

const slugSchema = z.object({ slug: z.string().min(1) });
const prefixSchema = z.object({ prefix: z.string().min(1) });

export const checkSlackSlugAction = actionClient
  .inputSchema(slugSchema)
  .action(async ({ parsedInput }) => {
    const { slug } = parsedInput;
    const [dbAvailable, existsInSlack] = await Promise.all([
      checkSlackChannelSlugAvailability(slug),
      slackChannelExists(slug),
    ]);
    return { available: dbAvailable && !existsInSlack };
  });

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
