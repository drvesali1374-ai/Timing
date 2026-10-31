/**
 * لایه Application ماژول فعالیت‌ها — CRUD + بایگانی + ترتیب (مدل B5 فاز ۲).
 * فعالیت داده پروژه است (نه نسخه پیکربندی)؛ تغییرها ممیزی می‌شوند.
 */

import { uuidv7 } from "@/shared/ids";
import { ApiError } from "@/shared/errors";
import { getLogger } from "@/shared/logger";
import { AUDIT_ACTIONS, recordAudit } from "@/modules/audit/application/audit-service";
import {
  assertActivityStableKey,
  assertWorkType,
  isSourceOfTime,
  isVaClassification,
} from "../domain/activity";
import {
  countActivities,
  findActivityByKey,
  findActivityById,
  insertActivityRow,
  listActivityRows,
  maxActivityOrder,
  updateActivityRow,
  instantiateActivityTemplates,
  type ActivityRow,
} from "../infrastructure/activity-repo";

export { instantiateActivityTemplates };

const log = getLogger("activities");

export interface ActivityDto {
  id: string;
  stableKey: string;
  name: string;
  description: string | null;
  workType: string;
  vaClassification: string | null;
  stationHint: string | null;
  skillRequired: string | null;
  sourceOfTime: string;
  order: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

function toDto(row: ActivityRow): ActivityDto {
  return {
    id: row.id,
    stableKey: row.stableKey,
    name: row.name,
    description: row.description,
    workType: row.workType,
    vaClassification: row.vaClassification,
    stationHint: row.stationHint,
    skillRequired: row.skillRequired,
    sourceOfTime: row.sourceOfTime,
    order: row.order,
    archived: row.archived,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listActivities(projectId: string, includeArchived = false): Promise<ActivityDto[]> {
  const rows = await listActivityRows(projectId, includeArchived);
  return rows.map(toDto);
}

export interface CreateActivityInput {
  projectId: string;
  userId: string;
  stableKey: string;
  name: string;
  description?: string;
  workType: string;
  vaClassification?: string | null;
  stationHint?: string | null;
  skillRequired?: string | null;
  sourceOfTime?: string;
}

export async function createActivity(input: CreateActivityInput): Promise<ActivityDto> {
  const { projectId, userId } = input;
  const stableKey = assertActivityStableKey(input.stableKey);
  if (!input.name?.trim()) throw ApiError.badRequest("نام فعالیت الزامی است.");
  const workType = assertWorkType(input.workType);
  if (input.vaClassification !== undefined && input.vaClassification !== null && !isVaClassification(input.vaClassification)) {
    throw ApiError.badRequest("طبقه‌بندی ارزش نامعتبر است — فقط با تأیید کاربر ثبت می‌شود.");
  }
  if (input.sourceOfTime !== undefined && !isSourceOfTime(input.sourceOfTime)) {
    throw ApiError.badRequest("منبع زمان نامعتبر است.");
  }
  const existing = await findActivityByKey(projectId, stableKey);
  if (existing) {
    throw ApiError.conflict(`فعالیت با شناسه «${stableKey}» از قبل وجود دارد.`);
  }

  const id = uuidv7();
  const order = (await maxActivityOrder(projectId)) + 1;
  await insertActivityRow({
    id,
    projectId,
    stableKey,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    workType,
    vaClassification: input.vaClassification ?? null,
    constraintsJson: null,
    stationHint: input.stationHint?.trim() || null,
    skillRequired: input.skillRequired?.trim() || null,
    sourceOfTime: input.sourceOfTime ?? "measured",
    order,
    createdBy: userId,
  });
  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.activityCreated,
    entityType: "Activity",
    entityId: id,
    projectId,
    after: { stableKey, name: input.name, workType },
  });
  log.info("activity created", { projectId, stableKey });
  const row = await findActivityById(projectId, id);
  if (!row) throw ApiError.internal();
  return toDto(row);
}

export interface UpdateActivityInput {
  projectId: string;
  userId: string;
  activityId: string;
  name?: string;
  description?: string | null;
  workType?: string;
  vaClassification?: string | null;
  stationHint?: string | null;
  skillRequired?: string | null;
  sourceOfTime?: string;
}

export async function updateActivity(input: UpdateActivityInput): Promise<ActivityDto> {
  const { projectId, userId, activityId } = input;
  const row = await findActivityById(projectId, activityId);
  if (!row) throw ApiError.notFound("فعالیت یافت نشد.");

  const data: Record<string, string | null> = {};
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  if (input.name !== undefined) {
    if (!input.name.trim()) throw ApiError.badRequest("نام فعالیت نمی‌تواند خالی باشد.");
    if (input.name !== row.name) {
      before.name = row.name;
      after.name = input.name.trim();
      data.name = input.name.trim();
    }
  }
  if (input.description !== undefined) {
    const normalized = input.description?.trim() || null;
    if (normalized !== row.description) {
      before.description = row.description;
      after.description = normalized;
      data.description = normalized;
    }
  }
  if (input.workType !== undefined) {
    const workType = assertWorkType(input.workType);
    if (workType !== row.workType) {
      before.workType = row.workType;
      after.workType = workType;
      data.workType = workType;
    }
  }
  if (input.vaClassification !== undefined) {
    if (input.vaClassification !== null && !isVaClassification(input.vaClassification)) {
      throw ApiError.badRequest("طبقه‌بندی ارزش نامعتبر است.");
    }
    if (input.vaClassification !== row.vaClassification) {
      before.vaClassification = row.vaClassification;
      after.vaClassification = input.vaClassification;
      data.vaClassification = input.vaClassification;
    }
  }
  if (input.stationHint !== undefined) {
    const normalized = input.stationHint?.trim() || null;
    if (normalized !== row.stationHint) {
      data.stationHint = normalized;
      after.stationHint = normalized;
    }
  }
  if (input.skillRequired !== undefined) {
    const normalized = input.skillRequired?.trim() || null;
    if (normalized !== row.skillRequired) {
      data.skillRequired = normalized;
      after.skillRequired = normalized;
    }
  }
  if (input.sourceOfTime !== undefined) {
    if (!isSourceOfTime(input.sourceOfTime)) throw ApiError.badRequest("منبع زمان نامعتبر است.");
    if (input.sourceOfTime !== row.sourceOfTime) {
      before.sourceOfTime = row.sourceOfTime;
      after.sourceOfTime = input.sourceOfTime;
      data.sourceOfTime = input.sourceOfTime;
    }
  }

  if (Object.keys(data).length > 0) {
    await updateActivityRow(projectId, activityId, data);
    await recordAudit({
      userId,
      action: AUDIT_ACTIONS.activityUpdated,
      entityType: "Activity",
      entityId: activityId,
      projectId,
      before,
      after,
    });
    log.info("activity updated", { projectId, activityId, fields: Object.keys(data) });
  }
  const updated = await findActivityById(projectId, activityId);
  if (!updated) throw ApiError.internal();
  return toDto(updated);
}

export async function setActivityArchived(
  projectId: string,
  userId: string,
  activityId: string,
  archived: boolean,
): Promise<ActivityDto> {
  const row = await findActivityById(projectId, activityId);
  if (!row) throw ApiError.notFound("فعالیت یافت نشد.");
  if (row.archived === archived) return toDto(row);
  await updateActivityRow(projectId, activityId, { archived });
  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.activityArchived,
    entityType: "Activity",
    entityId: activityId,
    projectId,
    before: { archived: row.archived },
    after: { archived },
  });
  const updated = await findActivityById(projectId, activityId);
  if (!updated) throw ApiError.internal();
  return toDto(updated);
}

/** شمار فعالیت‌های فعال — ورودی readiness پروژه */
export async function activeActivityCount(projectId: string): Promise<number> {
  return countActivities(projectId, false);
}
