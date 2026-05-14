import { z } from "zod";
import { type Department, departmentSchema } from "@/db/schema/auth";

export const fetchWorkspaceUsersPageSchema = z.object({
  pageToken: z.string().optional(),
  query: z.string().optional(),
});

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
  return status === "member" || status === "onboarding" ? department : null;
}

export const importGoogleWorkspaceUserSchema = z
  .object({
    googleWorkspaceUserId: z.string().min(1),
    firstName: z.string().min(1, "Please enter a first name."),
    lastName: z.string().min(1, "Please enter a last name."),
    batchNumber: z.number().optional(),
    department: z
      .enum(departmentSchema.options, {
        error: "Please select a department.",
      })
      .optional()
      .nullable(),
    status: importableUserStatus,
    paidThroughDate: z.iso.date().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const requiresDepartment =
      data.status === "member" || data.status === "onboarding";

    if (requiresDepartment && !data.department) {
      ctx.addIssue({
        code: "custom",
        message: "Please select a department.",
        path: ["department"],
      });
    }

    if (!requiresDepartment && data.department) {
      ctx.addIssue({
        code: "custom",
        message: "Alumni cannot have a department.",
        path: ["department"],
      });
    }
  });

export type ImportGoogleWorkspaceUserData = z.infer<
  typeof importGoogleWorkspaceUserSchema
>;
