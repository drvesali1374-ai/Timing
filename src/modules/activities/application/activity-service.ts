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
  findPrecedenceCycle,
  isSourceOfTime,
  isVaClassification,
  validatePredecessors,
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
import { getStationById, listStations } from "@/modules/stations/application/station-service";

export { instantiateActivityTemplates };

const log = getLogger("activities");

export interface ActivityDto {
  id: string;
  stableKey: string;
  name: string;
  description: string | null;
  workType: string;
  vaClassification: string | null;
  stationId: string | null;
  stationName: string | null;
  stationHint: string | null;
  skillRequired: string | null;
  sourceOfTime: string;
  order: number;
  archived: boolean;
  /** B5 — کلیدهای پیش‌نیاز (تقدم) */
  predecessors: string[];
  /** B5/B10 — قیود تخصیص تجزیه‌شده (ناسازگاری وظایف — مصرف‌کننده: بالانس فاز ۶) */
  constraints: { incompatibleWith: string[] };
  createdAt: string;
  updatedAt: string;
}

async function stationNameMap(projectId: string): Promise<Map<string, string>> {
  const stations = await listStations(projectId, true);
  return new Map(stations.map((s) => [s.id, s.name]));
}

function toDto(row: ActivityRow, stationNames?: Map<string, string>): ActivityDto {
  return {
    id: row.id,
    stableKey: row.stableKey,
    name: row.name,
    description: row.description,
    workType: row.workType,
    vaClassification: row.vaClassification,
    stationId: row.stationId,
    stationName: row.stationId ? (stationNames?.get(row.stationId) ?? null) : null,
    stationHint: row.stationHint,
    skillRequired: row.skillRequired,
    sourceOfTime: row.sourceOfTime,
    order: row.order,
    archived: row.archived,
    predecessors: parsePredecessors(row.predecessorsJson),
    constraints: parseConstraints(row.constraintsJson),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** تجزیه constraintsJson — فرمت معتبر: { incompatibleWith?: string[] } */
function parseConstraints(json: string | null): { incompatibleWith: string[] } {
  if (!json) return { incompatibleWith: [] };
  try {
    const parsed = JSON.parse(json) as { incompatibleWith?: unknown };
    return {
      incompatibleWith: Array.isArray(parsed.incompatibleWith)
        ? parsed.incompatibleWith.filter((v): v is string => typeof v === "string")
        : [],
    };
  } catch {
    return { incompatibleWith: [] };
  }
}

function parsePredecessors(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function listActivities(projectId: string, includeArchived = false): Promise<ActivityDto[]> {
  const [rows, stationNames] = await Promise.all([listActivityRows(projectId, includeArchived), stationNameMap(projectId)]);
  return rows.map((r) => toDto(r, stationNames));
}

export interface CreateActivityInput {
  projectId: string;
  userId: string;
  /** خالی/نامشخص = تولید خودکار (act-N) — تجربه ساده (دستورالعمل ۶٫۴) */
  stableKey?: string;
  name: string;
  description?: string;
  workType: string;
  vaClassification?: string | null;
  stationId?: string | null;
  stationHint?: string | null;
  skillRequired?: string | null;
  sourceOfTime?: string;
  predecessors?: string[];
}

export async function createActivity(input: CreateActivityInput): Promise<ActivityDto> {
  const { projectId, userId } = input;
  const stableKey = input.stableKey?.trim() ? assertActivityStableKey(input.stableKey) : await nextAutoStableKey(projectId);
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
  // ایستگاه مرتبط باید در همین پروژه موجود باشد (ADR-017)
  let stationId: string | null = null;
  if (input.stationId) {
    const station = await getStationById(projectId, input.stationId);
    if (!station || station.archived) throw ApiError.badRequest("ایستگاه انتخاب‌شده یافت نشد یا بایگانی است.");
    stationId = station.id;
  }
  // B5 — اعتبارسنجی پیش‌نیازها (ارجاع موجود، بدون خودارجاعی/تکرار)
  const predecessors = input.predecessors ?? [];
  if (predecessors.length > 0) {
    const rows = await listActivityRows(projectId, true);
    const knownKeys = rows.map((r) => r.stableKey);
    const v = validatePredecessors(stableKey, predecessors, knownKeys);
    if (!v.ok) throw ApiError.badRequest(v.messageFa);
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
    stationId,
    stationHint: input.stationHint?.trim() || null,
    skillRequired: input.skillRequired?.trim() || null,
    sourceOfTime: input.sourceOfTime ?? "measured",
    order,
    predecessorsJson: predecessors.length > 0 ? JSON.stringify(predecessors) : null,
    createdBy: userId,
  });
  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.activityCreated,
    entityType: "Activity",
    entityId: id,
    projectId,
    after: { stableKey, name: input.name, workType, predecessors, stationId },
  });
  log.info("activity created", { projectId, stableKey });
  const row = await findActivityById(projectId, id);
  if (!row) throw ApiError.internal();
  return toDto(row, await stationNameMap(projectId));
}

export interface UpdateActivityInput {
  projectId: string;
  userId: string;
  activityId: string;
  name?: string;
  description?: string | null;
  workType?: string;
  vaClassification?: string | null;
  stationId?: string | null;
  stationHint?: string | null;
  skillRequired?: string | null;
  sourceOfTime?: string;
  predecessors?: string[];
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
  if (input.stationId !== undefined) {
    if (input.stationId !== null) {
      const station = await getStationById(projectId, input.stationId);
      if (!station || station.archived) throw ApiError.badRequest("ایستگاه انتخاب‌شده یافت نشد یا بایگانی است.");
    }
    if (input.stationId !== row.stationId) {
      before.stationId = row.stationId;
      after.stationId = input.stationId;
      data.stationId = input.stationId;
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
  if (input.predecessors !== undefined) {
    const rows = await listActivityRows(projectId, true);
    const knownKeys = rows.map((r) => r.stableKey);
    const v = validatePredecessors(row.stableKey, input.predecessors, knownKeys);
    if (!v.ok) throw ApiError.badRequest(v.messageFa);
    // بررسی چرخه در سطح کل پروژه (شامل این تغییر) — B5
    const edges: Array<[string, string]> = [];
    for (const r of rows) {
      for (const p of parsePredecessors(r.predecessorsJson)) {
        edges.push([p, r.stableKey]);
      }
    }
    // جایگزینی یال‌های این فعالیت با مقدار جدید
    const filtered = edges.filter(([, after]) => after !== row.stableKey);
    for (const p of input.predecessors) filtered.push([p, row.stableKey]);
    const cycle = findPrecedenceCycle(filtered);
    if (cycle) {
      throw ApiError.badRequest(`چرخه تقدم تشکیل می‌شود: ${cycle.join(" ← ")}`);
    }
    if (JSON.stringify(input.predecessors) !== JSON.stringify(parsePredecessors(row.predecessorsJson))) {
      before.predecessors = parsePredecessors(row.predecessorsJson);
      after.predecessors = input.predecessors;
      data.predecessorsJson = input.predecessors.length > 0 ? JSON.stringify(input.predecessors) : null;
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
  return toDto(updated, await stationNameMap(projectId));
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

// ─────────────────── ورود گروهی فعالیت‌ها (ADR-017 — تجربه ساده) ───────────────────

export interface BulkActivityItem {
  name: string;
  stableKey?: string;
  description?: string;
  workType?: string;
  stationId?: string | null;
  sourceOfTime?: string;
}

export interface BulkCreateActivitiesResult {
  created: ActivityDto[];
  skipped: { name: string; reasonFa: string }[];
}

/** تولید شناسه فنی خودکار یکتا — act-1، act-2، … (بدون درگیری کاربر) */
async function nextAutoStableKey(projectId: string): Promise<string> {
  let n = (await countActivities(projectId, true)) + 1;
  for (;;) {
    const candidate = `act-${n}`;
    const exists = await findActivityByKey(projectId, candidate);
    if (!exists) return candidate;
    n += 1;
  }
}

/**
 * ورود گروهی فعالیت‌ها — برای فهرست‌های آماده (Paste از Excel/متن).
 * تکراری‌ها با دلیل فارسی رد می‌شوند؛ شناسه فنی خودکار تولید می‌شود.
 */
export async function createActivitiesBulk(
  projectId: string,
  userId: string,
  items: BulkActivityItem[],
): Promise<BulkCreateActivitiesResult> {
  if (items.length === 0) throw ApiError.badRequest("فهرست فعالیت‌ها خالی است.");
  if (items.length > 200) throw ApiError.badRequest("حداکثر ۲۰۰ فعالیت در هر دسته — فهرست را بخش‌بندی کنید.");
  const created: ActivityDto[] = [];
  const skipped: { name: string; reasonFa: string }[] = [];

  // اعتبارسنجی ایستگاه‌ها یک‌بار
  const stations = await listStations(projectId, false);
  const stationById = new Map(stations.map((s) => [s.id, s]));

  const seenNames = new Set<string>();
  const seenKeys = new Set<string>();
  const existingRows = await listActivityRows(projectId, false);
  const existingNames = new Set(existingRows.map((r) => r.name.replace(/\s+/g, " ")));
  const existingKeys = new Set(existingRows.map((r) => r.stableKey));
  for (const item of items) {
    const name = item.name?.trim();
    if (!name) {
      skipped.push({ name: item.name ?? "", reasonFa: "نام فعالیت خالی است." });
      continue;
    }
    const nameKey = name.replace(/\s+/g, " ");
    if (seenNames.has(nameKey)) {
      skipped.push({ name, reasonFa: "در همین فهرست تکراری است." });
      continue;
    }
    seenNames.add(nameKey);
    // تکراری با فعالیت موجود (توسط نام) — جلوگیری از ثبت ناخواسته تکراری
    if (existingNames.has(nameKey)) {
      skipped.push({ name, reasonFa: "فعالیتی با همین نام موجود است." });
      continue;
    }
    let stableKey = item.stableKey?.trim();
    if (stableKey) {
      try {
        stableKey = assertActivityStableKey(stableKey);
      } catch (e) {
        skipped.push({ name, reasonFa: (e as Error).message });
        continue;
      }
      if (seenKeys.has(stableKey) || existingKeys.has(stableKey)) {
        skipped.push({ name, reasonFa: `شناسه «${stableKey}» تکراری است.` });
        continue;
      }
    } else {
      stableKey = await nextAutoStableKey(projectId);
    }
    seenKeys.add(stableKey);
    existingNames.add(nameKey);
    existingKeys.add(stableKey);
    let stationId: string | null = null;
    if (item.stationId) {
      const st = stationById.get(item.stationId);
      if (!st) {
        skipped.push({ name, reasonFa: "ایستگاه انتخاب‌شده یافت نشد." });
        continue;
      }
      stationId = st.id;
    }
    const dto = await createActivity({
      projectId,
      userId,
      stableKey,
      name,
      description: item.description,
      workType: item.workType ?? "operatorManual",
      stationId,
      sourceOfTime: item.sourceOfTime,
    });
    created.push(dto);
  }
  if (created.length > 0) {
    await recordAudit({
      userId,
      action: AUDIT_ACTIONS.activityBulkCreated,
      entityType: "Activity",
      entityId: projectId,
      projectId,
      after: { created: created.length, skipped: skipped.length },
    });
  }
  log.info("activities bulk created", { projectId, created: created.length, skipped: skipped.length });
  return { created, skipped };
}
