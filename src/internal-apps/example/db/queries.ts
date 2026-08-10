import "server-only";

import { desc, eq } from "drizzle-orm";
import db from "@/db";
import { exampleNote } from "./schema";

/** The page renders every row it gets, so the query is bounded rather than
 * growing with the user's note count. */
const MAX_NOTES = 100;

export interface ExampleNote {
  id: string;
  body: string;
  createdAt: Date;
}

export async function listExampleNotes(userId: string): Promise<ExampleNote[]> {
  return db
    .select({
      id: exampleNote.id,
      body: exampleNote.body,
      createdAt: exampleNote.createdAt,
    })
    .from(exampleNote)
    .where(eq(exampleNote.userId, userId))
    .orderBy(desc(exampleNote.createdAt))
    .limit(MAX_NOTES);
}
