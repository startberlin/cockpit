import { desc } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

// Keep the retired table while previous deployments remain rollback candidates.
// No current app reads or writes it; dropping it requires a later contract release.
export const retiredExampleNote = pgTable(
  "example_note",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("example_note_user_id_idx").on(table.userId, desc(table.createdAt)),
  ],
);
