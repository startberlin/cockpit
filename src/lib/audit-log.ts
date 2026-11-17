import "server-only";

import db from "@/db";
import { auditLog } from "@/db/schema";
import { newId } from "@/lib/id";

export type AuditActor = { id: string; name: string } | "system";
export type AuditSubject = { id: string; name: string } | null;

export async function writeAuditLog(
  {
    category,
    eventType,
    actor = "system",
    subject = null,
    metadata = {},
    description,
  }: {
    category: string;
    eventType: string;
    actor?: AuditActor;
    subject?: AuditSubject;
    metadata?: Record<string, unknown>;
    description?: string;
  },
  executor: Pick<typeof db, "insert"> = db,
): Promise<string> {
  const id = newId("auditLog");
  await executor.insert(auditLog).values({
    id,
    category,
    eventType,
    actorId: actor === "system" ? null : actor.id,
    actorName: actor === "system" ? null : actor.name,
    subjectId: subject?.id ?? null,
    subjectName: subject?.name ?? null,
    metadata,
    description: description ?? null,
  });
  return id;
}
