import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import db from "@/db";
import { auditLog } from "@/db/schema";

export type { AuditLogEntry } from "./schema/audit-log";

export async function getAuditLogPage(
  page: number,
  pageSize: number,
  search?: string,
  category?: string,
): Promise<{ rows: (typeof auditLog.$inferSelect)[]; total: number }> {
  page = Math.max(1, page);
  pageSize = Math.max(1, pageSize);
  const conditions = [];

  if (category) {
    conditions.push(eq(auditLog.category, category));
  }

  if (search) {
    conditions.push(
      or(
        ilike(auditLog.actorName, `%${search}%`),
        ilike(auditLog.subjectName, `%${search}%`),
        ilike(auditLog.eventType, `%${search}%`),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(auditLog).where(where),
  ]);

  return { rows, total };
}
