import { z } from "zod";

export const editJobExpirySchema = z
  .object({
    id: z.string().min(1).max(80),
    expiresAt: z.iso.datetime(),
    expectedExpiresAt: z.iso.datetime(),
    expectedPublishedAt: z.iso.datetime(),
  })
  .strict();

export type EditJobExpiryInput = z.infer<typeof editJobExpirySchema>;
