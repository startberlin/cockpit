import { z } from "zod";
import {
  companyInputSchema,
  contactInputSchema,
  jobContentSchema,
} from "./contracts";

const idSchema = z.string().min(1).max(80);

export const editorValidationMessage: z.core.$ZodErrorMap = (issue) => {
  if (issue.code === "too_small" && issue.origin === "string")
    return issue.minimum === 1
      ? "This field is required."
      : `Enter at least ${issue.minimum} characters.`;
  if (
    issue.code === "too_small" &&
    issue.origin === "array" &&
    issue.minimum === 1
  )
    return "Enter at least one value.";
  return undefined;
};

export const saveCompanySchema = companyInputSchema
  .extend({
    id: idSchema.optional(),
    expectedUpdatedAt: z.iso.datetime().optional(),
    contacts: z.array(contactInputSchema).max(30),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.id && !input.expectedUpdatedAt)
      ctx.addIssue({
        code: "custom",
        path: ["expectedUpdatedAt"],
        message: "Reload the company before saving changes.",
      });
  });

export const saveJobSchema = z
  .object({
    id: idSchema.optional(),
    expectedDraftVersion: z.number().int().positive().optional(),
    companyId: z.string().min(1, "Choose the company for this job.").max(80),
    content: jobContentSchema,
    notes: z.string().trim().max(10000).default(""),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.id && input.expectedDraftVersion === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["expectedDraftVersion"],
        message: "Reload the draft before saving changes.",
      });
  });

export type SaveCompanyInput = z.input<typeof saveCompanySchema>;
export type SaveJobInput = z.input<typeof saveJobSchema>;
