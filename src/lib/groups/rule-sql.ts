import "server-only";

import { and, eq, gt, gte, inArray, lt, lte, or, type SQL } from "drizzle-orm";
import { user } from "@/db/schema/auth";
import { type FieldCondition, isFieldCondition, type RuleGroup } from "./rule";

function buildFieldSQL(c: FieldCondition): SQL<unknown> | undefined {
  switch (c.field) {
    case "department":
      return c.value.length > 0 ? inArray(user.department, c.value) : undefined;
    case "status":
      return c.value.length > 0 ? inArray(user.status, c.value) : undefined;
    case "batchNumber": {
      switch (c.op) {
        case "eq":
          return eq(user.batchNumber, c.value);
        case "lt":
          return lt(user.batchNumber, c.value);
        case "gt":
          return gt(user.batchNumber, c.value);
        case "gte":
          return gte(user.batchNumber, c.value);
        case "lte":
          return lte(user.batchNumber, c.value);
      }
    }
  }
}

export function buildRuleGroupSQL(rg: RuleGroup): SQL<unknown> | undefined {
  if (rg.conditions.length === 0) return undefined;

  const parts = rg.conditions
    .map((c) => (isFieldCondition(c) ? buildFieldSQL(c) : buildRuleGroupSQL(c)))
    .filter((p): p is SQL<unknown> => p !== undefined);

  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return rg.op === "AND" ? and(...parts) : or(...parts);
}
