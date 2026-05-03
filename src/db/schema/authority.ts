import { relations, sql } from "drizzle-orm";
import {
  check,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  accessGrants,
  authorityScopes,
  organizationPositions,
} from "@/lib/authority/model";
import { department, user } from "./auth";

export const organizationPosition = pgEnum(
  "organization_position",
  organizationPositions,
);

export type OrganizationPosition =
  (typeof organizationPosition.enumValues)[number];

export const accessGrant = pgEnum("access_grant", accessGrants);

export type AccessGrant = (typeof accessGrant.enumValues)[number];

export const authorityScope = pgEnum("authority_scope", authorityScopes);

export type AuthorityScope = (typeof authorityScope.enumValues)[number];

export const userOrganizationPosition = pgTable(
  "user_organization_position",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    position: organizationPosition("position").notNull(),
    scope: authorityScope("scope").notNull(),
    department: department("department"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    unique("user_position_scope_department_unique")
      .on(table.userId, table.position, table.scope, table.department)
      .nullsNotDistinct(),
    uniqueIndex("one_president_unique")
      .on(table.position)
      .where(
        sql`${table.position} = 'president' AND ${table.scope} = 'global'`,
      ),
    uniqueIndex("one_vice_president_unique")
      .on(table.position)
      .where(
        sql`${table.position} = 'vice_president' AND ${table.scope} = 'global'`,
      ),
    uniqueIndex("one_head_of_finance_unique")
      .on(table.position)
      .where(
        sql`${table.position} = 'head_of_finance' AND ${table.scope} = 'global'`,
      ),
    uniqueIndex("one_department_head_per_department_unique")
      .on(table.department)
      .where(
        sql`${table.position} = 'department_head' AND ${table.scope} = 'department'`,
      ),
    check(
      "user_organization_position_valid_scope_check",
      sql`(
        (${table.position} IN ('president', 'vice_president', 'head_of_finance') AND ${table.scope} = 'global' AND ${table.department} IS NULL)
        OR (${table.position} = 'department_head' AND ${table.scope} = 'department' AND ${table.department} IS NOT NULL)
      )`,
    ),
  ],
);

export const userAccessGrant = pgTable(
  "user_access_grant",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    grant: accessGrant("grant").notNull(),
    scope: authorityScope("scope").notNull(),
    department: department("department"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    unique("user_grant_scope_department_unique")
      .on(table.userId, table.grant, table.scope, table.department)
      .nullsNotDistinct(),
    check(
      "user_access_grant_valid_scope_check",
      sql`(
        ${table.grant} = 'admin' AND ${table.scope} = 'global' AND ${table.department} IS NULL
      )`,
    ),
  ],
);

export const userOrganizationPositionRelations = relations(
  userOrganizationPosition,
  ({ one }) => ({
    user: one(user, {
      fields: [userOrganizationPosition.userId],
      references: [user.id],
    }),
  }),
);

export const userAccessGrantRelations = relations(
  userAccessGrant,
  ({ one }) => ({
    user: one(user, {
      fields: [userAccessGrant.userId],
      references: [user.id],
    }),
  }),
);
