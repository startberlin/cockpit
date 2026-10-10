import { z } from "zod";
import { blocksSchema } from "../lib/blocks";

/**
 * Input schemas for the newsletter's server actions.
 *
 * Kept out of the `"use server"` files: those may only export async functions,
 * so a schema exported alongside an action fails to compile. Collected in one
 * file because the client forms import them for `zodResolver`.
 */

export const createIssueSchema = z.object({
  name: z.string().trim().min(1, "Give the issue a working name.").max(120),
});

export const updateIssueSchema = z.object({
  id: z.string().min(1),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  name: z.string().trim().min(1, "Give the issue a working name.").max(120),
  subject: z.string().max(200),
  previewText: z.string().max(200),
  blocks: blocksSchema,
});

export const issueIdSchema = z.object({ id: z.string().min(1) });

export const renderPreviewSchema = z.object({
  subject: z.string(),
  previewText: z.string(),
  blocks: blocksSchema,
});

export const sendTestSchema = z.object({
  id: z.string().min(1),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  recipients: z
    .string()
    .min(1, "Add at least one address.")
    .transform((value) =>
      value
        .split(/[;,\s]+/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.email("That is not a valid email address."))
        .min(1, "Add at least one address.")
        .max(10, "Ten test recipients at most."),
    ),
});

/**
 * Scheduling also carries the sending settings.
 *
 * The schedule dialog is where an issue is finalised for delivery, so segment,
 * topic and addresses are confirmed in the same step rather than saved
 * somewhere earlier and hoped to still be right. Sending them together also
 * removes the window where a separate save could succeed and the schedule fail,
 * leaving the issue configured for a send that never happened.
 *
 * All optional: an unspecified field keeps whatever the issue already has.
 */
const optionalSender = z
  .string()
  .trim()
  .max(200)
  .refine((value) => {
    if (!value) return true;
    if (/[\r\n]/.test(value)) return false;
    const address = value.match(/^[^<>]+<([^<>]+)>$/)?.[1] ?? value;
    return z.email().safeParse(address).success;
  }, "Enter a valid From address, such as START Berlin <newsletter@example.com>.")
  .optional();

export const scheduleIssueSchema = z.object({
  id: z.string().min(1),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  /**
   * Empty means "send now". A local datetime string from `<input
   * type="datetime-local">`, interpreted in the browser's zone and converted to
   * an instant on the client before it gets here.
   */
  scheduledAt: z
    .union([
      z.literal(""),
      z.iso
        .datetime({ offset: true })
        .refine(
          (value) => Date.parse(value) > Date.now(),
          "Choose a send time in the future.",
        ),
    ])
    .optional(),
  fromAddress: optionalSender,
  replyTo: z
    .union([z.literal(""), z.email("Enter a valid Reply-to email address.")])
    .optional(),
  segmentId: z.string().max(100).optional(),
  topicId: z.string().max(100).optional(),
});

/**
 * Preflight can be asked about a segment the issue has not been saved with yet,
 * so the dialog can show an accurate recipient count while someone is still
 * choosing.
 */
export const preflightSchema = z.object({
  id: z.string().min(1),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  segmentId: z.string().max(100).optional(),
});

export const assignSegmentSchema = z.object({
  segmentId: z.string().min(1, "Pick a segment."),
});

export const suggestPreviewTextSchema = z.object({
  id: z.string().min(1),
  subject: z.string().max(200),
});

export const importGroupSchema = z.object({
  groupSlug: z.string().min(1, "Pick a group."),
});
