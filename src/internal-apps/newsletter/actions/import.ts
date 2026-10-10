"use server";

import { revalidatePath } from "next/cache";
import { env } from "@/env";
import { actionClient } from "@/lib/action-client";
import { assertNewsletterAccess } from "../lib/access";
import {
  buildImportCsv,
  listImportGroups,
  previewCockpitImport,
} from "../lib/cockpit-import";
import { importContactsCsv, sendMode } from "../lib/resend";
import { importGroupSchema } from "./schemas";

export const listImportGroupsAction = actionClient.action(async () => {
  await assertNewsletterAccess();
  return { groups: await listImportGroups() };
});

export const previewImportAction = actionClient
  .inputSchema(importGroupSchema)
  .action(async ({ parsedInput }) => {
    await assertNewsletterAccess();

    const preview = await previewCockpitImport(parsedInput.groupSlug);

    // The candidate list can be several hundred people; the dialog only needs
    // the counts and enough rows to make the import legible.
    return {
      groupSlug: preview.groupSlug,
      groupName: preview.groupName,
      memberCount: preview.memberCount,
      withoutEmail: preview.withoutEmail,
      existing: preview.existing,
      fresh: preview.fresh,
      sample: preview.candidates.slice(0, 8).map((c) => c.email),
    };
  });

export const runImportAction = actionClient
  .inputSchema(importGroupSchema)
  .action(async ({ parsedInput }) => {
    await assertNewsletterAccess();

    const preview = await previewCockpitImport(parsedInput.groupSlug);
    if (!preview.candidates.length) {
      throw new Error("That group has nobody with a usable email address.");
    }

    const importedAt = new Date().toISOString().slice(0, 10);
    const csv = buildImportCsv(preview.candidates, {
      groupSlug: preview.groupSlug,
      importedAt,
    });

    const result = await importContactsCsv({
      csv,
      filename: `cockpit-${preview.groupSlug}-${importedAt}.csv`,
      segmentId: env.RESEND_NEWSLETTER_SEGMENT_ID,
      topicId: env.RESEND_NEWSLETTER_TOPIC_ID,
    });

    revalidatePath("/newsletter/audience");
    return {
      importId: result.id,
      submitted: preview.candidates.length,
      mode: sendMode(),
    };
  });
