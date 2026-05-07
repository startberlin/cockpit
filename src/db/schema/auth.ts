import { type InferSelectModel, relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { batch } from "./batch";

export const legalMembershipState = pgEnum("legal_membership_state", [
  "not_member",
  "active_member",
  "former_member",
]);

export type LegalMembershipState =
  (typeof legalMembershipState.enumValues)[number];

export const userStatus = pgEnum("user_status", [
  "onboarding",
  "member",
  "supporting_alumni",
  "alumni",
]);

export type UserStatus = (typeof userStatus.enumValues)[number];

export const department = pgEnum("department", [
  "partnerships",
  "operations",
  "community",
  "growth",
  "events",
]);

export type Department = (typeof department.enumValues)[number];

export const departmentSchema = createSelectSchema(department);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  street: text("street"),
  state: text("state"),
  city: text("city"),
  zip: text("zip"),
  country: text("country"),
  personalEmail: text("personal_email").notNull(),
  batchNumber: integer("batch_number")
    .notNull()
    .references(() => batch.number, { onDelete: "cascade" }),
  phone: text("phone"),
  status: userStatus("status").notNull().default("onboarding"),
  department: department("department"),
  legalMembershipState: legalMembershipState("legal_membership_state")
    .notNull()
    .default("not_member"),
});

export const usersRelations = relations(user, ({ one, many }) => ({
  batch: one(batch, { fields: [user.batchNumber], references: [batch.number] }),
  // usersToGroups relation will be defined in the schema/index.ts to avoid circular dependency
}));

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export type User = InferSelectModel<typeof user>;
