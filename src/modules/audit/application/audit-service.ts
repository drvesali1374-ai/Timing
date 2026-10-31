/**
 * لایه Application ماژول ممیزی — ثبت رویدادهای حساس (ADR-009).
 * عملیات ممیزی‌شده در فاز ۱: ایجاد/ویرایش/بایگانی/تکثیر پروژه،
 * ایجاد نسخه پیکربندی، تغییر اعضا/نقش‌ها، ثبت‌نام کاربر.
 */
import { uuidv7 } from "@/shared/ids";
import { getLogger } from "@/shared/logger";
import { recordAuditEntry, listAuditEntries } from "../infrastructure/audit-repo";
import type { AuditEntryDto } from "@/shared/contracts/api";

const log = getLogger("audit");

export const AUDIT_ACTIONS = {
  userRegistered: "user.registered",
  projectCreated: "project.created",
  projectUpdated: "project.updated",
  projectArchived: "project.archived",
  projectUnarchived: "project.unarchived",
  projectDuplicated: "project.duplicated",
  configVersionCreated: "config.version-created",
  // ── فاز ۲ ──
  parameterValueSaved: "param.value-saved",
  formulaEvaluated: "formula.evaluated",
  activityCreated: "activity.created",
  activityUpdated: "activity.updated",
  activityArchived: "activity.archived",
  configImported: "config.imported",
  memberAdded: "member.added",
  memberRoleChanged: "member.role-changed",
  memberRemoved: "member.removed",
} as const;

export interface AuditInput {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  projectId?: string | null;
  before?: unknown;
  after?: unknown;
}

/** ثبت رخداد ممیزی — هرگز نباید مسیر عملیات اصلی را قطع کند؛ خطای ممیزی فقط لاگ می‌شود. */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await recordAuditEntry({
      id: uuidv7(),
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      projectId: input.projectId ?? null,
      beforeJson: input.before === undefined ? null : JSON.stringify(input.before),
      afterJson: input.after === undefined ? null : JSON.stringify(input.after),
    });
  } catch (err) {
    log.error("failed to record audit entry", { action: input.action, error: String(err) });
  }
}

/** فهرست ممیزی پروژه (مرتب بر اساس جدیدترین). */
export async function getProjectAuditTrail(projectId: string, limit = 100): Promise<AuditEntryDto[]> {
  const entries = await listAuditEntries(projectId, limit);
  return entries.map((e) => ({
    id: e.id,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    projectId: e.projectId,
    userName: e.user?.name ?? null,
    userEmail: e.user?.email ?? null,
    createdAt: e.createdAt.toISOString(),
  }));
}
