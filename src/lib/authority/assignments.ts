import { z } from "zod";
import { department } from "@/db/schema/auth";
import {
  departmentHeadPosition,
  globalAccessGrants,
  globalOrganizationPositions,
} from "./model";

const departmentValue = z.enum(department.enumValues);

export const positionAssignmentSchema = z.union([
  z.object({
    position: z.enum(globalOrganizationPositions),
    scope: z.literal("global"),
    department: z.null().optional(),
  }),
  z.object({
    position: z.literal(departmentHeadPosition),
    scope: z.literal("department"),
    department: departmentValue,
  }),
]);

export const grantAssignmentSchema = z.union([
  z.object({
    grant: z.enum(globalAccessGrants),
    scope: z.literal("global"),
    department: z.null().optional(),
  }),
]);

const rawAuthorityUpdateInputSchema = z
  .object({
    userId: z.string(),
    positions: z.array(positionAssignmentSchema),
    grants: z.array(grantAssignmentSchema),
  })
  .superRefine((input, ctx) => {
    const seenPositions = new Set<string>();
    const seenGrants = new Set<string>();

    for (const [index, assignment] of input.positions.entries()) {
      const key = [
        assignment.position,
        assignment.scope,
        assignment.scope === "department" ? assignment.department : "global",
      ].join(":");

      if (seenPositions.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: "Duplicate organization position assignment.",
          path: ["positions", index],
        });
      }

      seenPositions.add(key);
    }

    for (const [index, assignment] of input.grants.entries()) {
      const key = [assignment.grant, assignment.scope, "global"].join(":");

      if (seenGrants.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: "Duplicate access grant assignment.",
          path: ["grants", index],
        });
      }

      seenGrants.add(key);
    }
  });

export const authorityUpdateInputSchema =
  rawAuthorityUpdateInputSchema.transform((input) => ({
    userId: input.userId,
    positions: input.positions.map((assignment) => ({
      ...assignment,
      department:
        assignment.scope === "department" ? assignment.department : null,
    })),
    grants: input.grants.map((assignment) => ({
      ...assignment,
      department: null,
    })),
  }));

export type AuthorityUpdateInput = z.infer<typeof authorityUpdateInputSchema>;
