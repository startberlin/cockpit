import { z } from "zod";
import { departmentSchema, userStatus } from "@/db/schema/auth";

export const createUserSchema = z.object({
  firstName: z.string().min(1, "Please enter a first name."),
  lastName: z.string().min(1, "Please enter a last name."),
  personalEmail: z.email().min(1, "Please enter a valid email address."),
  batchNumber: z.number().optional(),
  department: z.enum(departmentSchema.options).nullable().optional(),
  status: z.enum(userStatus.enumValues, {
    error: "Please select a status.",
  }),
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;
