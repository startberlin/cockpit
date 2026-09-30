import { desc } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "@/db/schema/auth";

/**
 * Tables owned by the example app.
 *
 * Conventions for app schemas:
 *  - Table names are prefixed `<slug>_` — everything shares one Postgres schema,
 *    so the prefix is what prevents collisions between apps.
 *  - Import core tables (`user`, ...) from their defining file, never from
 *    `@/db/schema` — the same sibling-import rule the core schema follows to
 *    avoid cycles.
 *  - Module tables are deliberately NOT added to the aggregate `schema` object
 *    in `src/db/schema/index.ts`, which is shared with the Better Auth adapter.
 *    That means no `db.query.*` relational API here; use the core query builder
 *    with explicit joins.
 */
export const exampleNote = pgTable(
  "example_note",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  // Composite, in the shape `listExampleNotes` reads: filter by user, newest first.
  (table) => [
    index("example_note_user_id_idx").on(table.userId, desc(table.createdAt)),
  ],
);
