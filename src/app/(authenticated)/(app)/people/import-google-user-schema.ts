import { z } from "zod";
import { type Department, departmentSchema } from "@/db/schema/auth";

export const importableUserStatus = z.enum([
  "member",
  "supporting_alumni",
  "alumni",
  "onboarding",
]);

export type ImportableUserStatus = z.infer<typeof importableUserStatus>;

export function normalizeImportedDepartment(
  status: ImportableUserStatus,
  department: Department | null | undefined,
) {
  return status === "member" ? department : null;
}

export const importGoogleWorkspaceUserSchema = z
  .object({
    googleWorkspaceUserId: z.string().min(1),
    firstName: z.string().min(1, "Please enter a first name."),
    lastName: z.string().min(1, "Please enter a last name."),
    batchNumber: z.number("Please select a batch."),
    department: z
      .enum(departmentSchema.options, {
        error: "Please select a department.",
      })
      .optional()
      .nullable(),
    status: importableUserStatus,
    paidThroughAt: z.iso.date().optional().or(z.literal("")),
    documentsVerified: z.boolean().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.status === "member" && !input.department) {
      ctx.addIssue({
        code: "custom",
        message: "Please select a department.",
        path: ["department"],
      });
    }

    if (
      (input.status === "member" || input.status === "supporting_alumni") &&
      input.documentsVerified === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Please indicate whether documents have been verified.",
        path: ["documentsVerified"],
      });
    }
  });

export type ImportGoogleWorkspaceUserData = z.infer<
  typeof importGoogleWorkspaceUserSchema
>;
