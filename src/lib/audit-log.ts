import "server-only";

import db from "@/db";
import { auditLog } from "@/db/schema/audit-log";
import { newId } from "@/lib/id";

export type AuditActor = { id: string; name: string } | "system";
export type AuditSubject = { id: string; name: string } | null;

export async function writeAuditLog({
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
}): Promise<void> {
  await db.insert(auditLog).values({
    id: newId("auditLog"),
    category,
    eventType,
    actorId: actor === "system" ? null : actor.id,
    actorName: actor === "system" ? null : actor.name,
    subjectId: subject?.id ?? null,
    subjectName: subject?.name ?? null,
    metadata,
    description: description ?? null,
  });
}
