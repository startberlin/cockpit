import type { Department, UserStatus } from "@/db/schema/auth";

export type FieldCondition =
  | { field: "department"; op: "in"; value: Department[] }
  | { field: "status"; op: "in"; value: UserStatus[] }
  | {
      field: "batchNumber";
      op: "eq" | "lt" | "gt" | "gte" | "lte";
      value: number;
    };

export type RuleGroup = {
  op: "AND" | "OR";
  conditions: (FieldCondition | RuleGroup)[];
};

export function isFieldCondition(
  c: FieldCondition | RuleGroup,
): c is FieldCondition {
  return "field" in c;
}
