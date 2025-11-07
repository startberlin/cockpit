import z from "zod";

export const addPeopleSchema = z.object({
  users: z.array(
    z.object({
      firstName: z.string(),
      lastName: z.string(),
      personalEmail: z.string(),
      batchNumber: z.number(),
      departmentId: z.string(),
    }),
  ),
});
