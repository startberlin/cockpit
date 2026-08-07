import "server-only";

import { desc, eq } from "drizzle-orm";
import db from "@/db";
import { exampleNote } from "./schema";

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
    .orderBy(desc(exampleNote.createdAt));
}
