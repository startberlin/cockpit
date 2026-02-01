import { z } from "zod";
import { departmentSchema, userStatus } from "@/db/schema/auth";

// Schema allows empty string for initial form state, but refines to require a valid department
export const createUserSchema = z.object({
  firstName: z.string().min(1, "Please enter a first name."),
  lastName: z.string().min(1, "Please enter a last name."),
  personalEmail: z.email().min(1, "Please enter a valid email address."),
  batchNumber: z.number("Please select a batch."),
  department: z.enum(departmentSchema.options, {
    error: "Please select a department.",
  }),
  status: z.enum(userStatus.enumValues, {
    error: "Please select a status.",
  }),
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;
