import { z } from "zod";
import { type Department, departmentSchema } from "@/db/schema/auth";

export const searchGoogleWorkspaceUsersSchema = z.object({
  query: z.string().trim().min(2, "Enter at least two characters."),
});

export const importableUserStatus = z.enum([
  "member",
  "supporting_alumni",
  "alumni",
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
    googleWorkspaceId: z.string().min(1),
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
  })
  .superRefine((input, ctx) => {
    if (input.status === "member" && !input.department) {
      ctx.addIssue({
        code: "custom",
        message: "Please select a department.",
        path: ["department"],
      });
    }
  });

export type ImportGoogleWorkspaceUserData = z.infer<
  typeof importGoogleWorkspaceUserSchema
>;
