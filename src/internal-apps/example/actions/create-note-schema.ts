import { z } from "zod";

/**
 * Kept out of `create-note.ts`: a `"use server"` file may only export async
 * functions, so exporting a schema from it fails to compile.
 */
export const createNoteSchema = z.object({
  body: z.string().min(1, "Write something first.").max(500),
});
