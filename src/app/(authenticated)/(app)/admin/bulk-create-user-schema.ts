import { z } from "zod";
import { departmentSchema, userStatus } from "@/db/schema/auth";

export const bulkCreateEntrySchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  personalEmail: z.email("Invalid email"),
});

export const bulkCreateUserSchema = z
  .object({
    entries: z
      .array(bulkCreateEntrySchema)
      .min(1, "Add at least one entry")
      .max(50, "Maximum 50 entries per batch"),
    department: z.enum(departmentSchema.options).nullable(),
    status: z.enum(userStatus.enumValues),
    batchNumber: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    const requiresDepartment =
      data.status === "member" || data.status === "onboarding";

    if (requiresDepartment && !data.department) {
      ctx.addIssue({
        code: "custom",
        message: "Department is required for member/onboarding status",
        path: ["department"],
      });
    }
  });

export type BulkCreateUserInput = z.infer<typeof bulkCreateUserSchema>;
export type BulkCreateEntry = z.infer<typeof bulkCreateEntrySchema>;
