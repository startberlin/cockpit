import { z } from "zod";
import { publishInputSchema } from "../lib/contracts";
import { saveCompanySchema, saveJobSchema } from "../lib/editor-schemas";

export { editJobExpirySchema } from "../lib/expiry";
export { saveCompanySchema, saveJobSchema };

const idSchema = z.string().min(1).max(80);
export const submissionReviewSchema = z.object({ id: idSchema });
export const companySearchSchema = z.object({
  q: z.string().max(300),
  selectedId: idSchema.optional(),
});
export const publishJobSchema = publishInputSchema.extend({ id: idSchema });
export const setJobStatusSchema = z.object({
  id: idSchema,
  status: z.enum(["paused", "closed", "draft"]),
});
export const acceptSubmissionSchema = z.object({
  id: idSchema,
  companyId: idSchema.min(
    1,
    "Select the employer explicitly before accepting.",
  ),
});
export const rejectSubmissionSchema = z.object({
  id: idSchema,
  note: z
    .string()
    .trim()
    .min(5, "Add a brief reason for the rejection.")
    .max(2000),
});
export const deleteCompanySchema = z.object({ id: idSchema });
export type SaveJobInput = z.infer<typeof saveJobSchema>;
export type SaveCompanyInput = z.infer<typeof saveCompanySchema>;
