import { and, count, desc, eq } from "drizzle-orm";
import db from "@/db";
import { auditLog } from "@/db/schema";
import { unaccentSearch } from "@/lib/search";

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
    const searchClause = unaccentSearch(
      search,
      auditLog.actorName,
      auditLog.subjectName,
      auditLog.eventType,
    );
    if (searchClause) conditions.push(searchClause);
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
