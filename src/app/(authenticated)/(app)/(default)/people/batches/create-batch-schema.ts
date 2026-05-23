import { z } from "zod";

export const createBatchSchema = z.object({
  number: z
    .number({ message: "Please enter a batch number." })
    .int("Batch number must be a whole number.")
    .positive("Batch number must be positive."),
  startDate: z
    .string({ message: "Please enter a start date." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter a valid date (YYYY-MM-DD)."),
});

export type CreateBatchFormData = z.infer<typeof createBatchSchema>;
