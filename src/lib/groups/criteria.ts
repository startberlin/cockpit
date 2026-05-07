import { z } from "zod";
import { department, userStatus } from "@/db/schema/auth";

export const addGroupCriteriaSchema = z
  .object({
    groupId: z.string(),
    name: z.string().min(1, "Criteria name is required"),
    department: z.enum(department.enumValues).optional(),
    status: z.enum(userStatus.enumValues).optional(),
    batchNumber: z.number().int().positive().optional(),
  })
  .refine(
    (criteria) =>
      criteria.department || criteria.status || criteria.batchNumber,
    {
      message:
        "At least one department, status, or batch criterion is required.",
    },
  );

export type AddGroupCriteriaInput = z.infer<typeof addGroupCriteriaSchema>;

export const normalizedGroupCriteriaSchema = z.object({
  groupId: z.string(),
  match: z.enum(["all", "any"]).default("any"),
  criteria: z.object({
    departments: z.array(z.enum(department.enumValues)).default([]),
    statuses: z.array(z.enum(userStatus.enumValues)).default([]),
    batchNumbers: z.array(z.number().int().positive()).default([]),
  }),
});

export type NormalizedGroupCriteriaInput = z.infer<
  typeof normalizedGroupCriteriaSchema
>;
