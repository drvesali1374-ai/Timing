/**
 * زیرساخت ماژول ممیزی — Prisma AuditLog.
 */
import { db } from "@/lib/db";

export interface AuditEntryRecord {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  projectId: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: Date;
  user?: { name: string | null; email: string } | null;
}

export async function recordAuditEntry(data: {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  projectId: string | null;
  beforeJson: string | null;
  afterJson: string | null;
}): Promise<void> {
  await db.auditLog.create({ data });
}

export async function listAuditEntries(projectId: string, limit: number): Promise<AuditEntryRecord[]> {
  return db.auditLog.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, email: true } } },
  });
}
