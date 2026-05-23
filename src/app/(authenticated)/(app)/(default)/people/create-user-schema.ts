import { z } from "zod";
import { departmentSchema, userStatus } from "@/db/schema/auth";

export const companyEmailSchema = z
  .email("Please enter a valid email address.")
  .refine(
    (e) => e.endsWith("@start-berlin.com"),
    "Must end with @start-berlin.com",
  )
  .refine(
    (e) => e.split("@")[0].includes("."),
    "Must contain a dot before the @, e.g. firstname.lastname@start-berlin.com",
  );

export const createUserSchema = z
  .object({
    firstName: z.string().min(1, "Please enter a first name."),
    lastName: z.string().min(1, "Please enter a last name."),
    personalEmail: z.email().min(1, "Please enter a valid email address."),
    companyEmail: companyEmailSchema,
    batchNumber: z.number().optional(),
    department: z.enum(departmentSchema.options).nullable().optional(),
    status: z.enum(userStatus.enumValues, {
      error: "Please select a status.",
    }),
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

export type CreateUserFormData = z.infer<typeof createUserSchema>;
