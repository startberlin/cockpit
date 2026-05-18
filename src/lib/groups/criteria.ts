import { z } from "zod";
import { department, userStatus } from "@/db/schema/auth";

export const fieldConditionSchema = z.discriminatedUnion("field", [
  z.object({
    field: z.literal("department"),
    op: z.literal("in"),
    value: z
      .array(z.enum(department.enumValues))
      .min(1, "Select at least one department"),
  }),
  z.object({
    field: z.literal("status"),
    op: z.literal("in"),
    value: z
      .array(z.enum(userStatus.enumValues))
      .min(1, "Select at least one status"),
  }),
  z.object({
    field: z.literal("batchNumber"),
    op: z.enum(["eq", "lt", "gt", "gte", "lte"]),
    value: z.number().int().positive(),
  }),
]);

type RuleGroupInput = {
  op: "AND" | "OR";
  conditions: (z.infer<typeof fieldConditionSchema> | RuleGroupInput)[];
};

export const ruleGroupSchema: z.ZodType<RuleGroupInput> = z.lazy(() =>
  z.object({
    op: z.enum(["AND", "OR"]),
    conditions: z
      .array(z.union([fieldConditionSchema, ruleGroupSchema]))
      .min(1, "At least one condition is required"),
  }),
);

export type { RuleGroupInput };

export const addGroupCriteriaSchema = z.object({
  groupId: z.string(),
  name: z.string().min(1, "Rule name is required"),
  conditions: ruleGroupSchema,
});

export type AddGroupCriteriaInput = z.infer<typeof addGroupCriteriaSchema>;

// Kept for the bulk-add dialog (separate feature from automatic criteria matching)
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
