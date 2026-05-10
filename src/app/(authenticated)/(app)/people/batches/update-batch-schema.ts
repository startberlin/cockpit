import { z } from "zod";

export const updateBatchSchema = z.object({
  number: z.number().int().positive(),
  startDate: z
    .string({ message: "Please enter a start date." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter a valid date (YYYY-MM-DD)."),
});

export type UpdateBatchFormData = z.infer<typeof updateBatchSchema>;
