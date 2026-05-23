import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    category: text("category").notNull(),
    eventType: text("event_type").notNull(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorName: text("actor_name"),
    subjectId: text("subject_id").references(() => user.id, {
      onDelete: "set null",
    }),
    subjectName: text("subject_name"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_created_at_idx").on(table.createdAt),
    index("audit_log_category_idx").on(table.category),
    index("audit_log_actor_id_idx").on(table.actorId),
    index("audit_log_subject_id_idx").on(table.subjectId),
  ],
);

export type AuditLogEntry = typeof auditLog.$inferSelect;
