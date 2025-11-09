import { z } from "zod";
import { userStatus } from "@/db/schema/auth";

export const singleUserSchema = z.object({
  firstName: z.string().min(1, "Please enter a first name."),
  lastName: z.string().min(1, "Please enter a last name."),
  personalEmail: z.email().min(1, "Please enter a valid email address."),
  batchNumber: z.number("Please select a batch."),
  departmentId: z.string().min(1, "Please select a department."),
  status: z.enum(userStatus.enumValues, {
    error: "Please select a status.",
  }),
});

export const createUserSchema = z.object({
  users: z.array(singleUserSchema).min(1, "Add at least one user."),
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;
