import { newId } from "@/lib/id";
import db from ".";
import { auditLog } from "./schema/audit-log";

export function auditLogValues({
  action,
  entityType,
  entityId,
  actorUserId,
  targetUserId,
  payload,
}: {
  action: string;
  entityType: string;
  entityId: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  return {
    id: newId("auditLog"),
    action,
    entityType,
    entityId,
    actorUserId: actorUserId ?? null,
    targetUserId: targetUserId ?? null,
    payload: payload ?? null,
  };
}

export async function recordAuditLog(
  input: Parameters<typeof auditLogValues>[0],
) {
  const [record] = await db
    .insert(auditLog)
    .values(auditLogValues(input))
    .returning();

  return record;
}
