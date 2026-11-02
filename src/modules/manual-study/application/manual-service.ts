/**
 * لایه Application ماژول مطالعه دستی — برگه ثبت زمان (ADR-017).
 * ----------------------------------------------------------------
 * ورود دستی زمان‌های اندازه‌گیری‌شده در جدول فعالیت × نمونه؛ وقفه‌های ثبت‌شده؛
 * اصلاح با دلیل الزامی + ممیزی؛ نهایی‌سازی برای ورود به موتور تحلیل.
 */

import { uuidv7 } from "@/shared/ids";
import { ApiError } from "@/shared/errors";
import { getLogger } from "@/shared/logger";
import { AUDIT_ACTIONS, recordAudit } from "@/modules/audit/application/audit-service";
import { parseDurationMs } from "@/shared/timing/parse-duration";
import {
  assertSampleIndex,
  isManualSheetStatus,
  isObservationSource,
  validateInterruptionReason,
} from "../domain/manual";
import {
  manualSheetStatusFa,
  MAX_SAMPLES,
  INTERRUPTION_REASON_LABELS_FA,
  type ManualCellDto,
  type ManualInterruptionDto,
  type ManualSheetDetailDto,
  type ManualSheetRowDto,
  type ManualSheetSummaryDto,
  type SaveCellsResult,
} from "@/shared/contracts/manual-study";

// صادرات قرارداد برای مصرف‌کنندگان داخلی (routes از shared می‌گیرند)
export type {
  ManualCellDto,
  ManualInterruptionDto,
  ManualSheetDetailDto,
  ManualSheetRowDto,
  ManualSheetSummaryDto,
  SaveCellsResult,
} from "@/shared/contracts/manual-study";
import {
  countInterruptionsBySheets,
  countObservations,
  countObservationsBySheets,
  deleteInterruptionRow,
  deleteObservationRows,
  deleteObservationsBeyondSamples,
  findInterruptionById,
  findObservationById,
  findSheetById,
  insertInterruptionRow,
  insertSheetRow,
  listInterruptionRows,
  listObservationRows,
  listSheetRows,
  updateInterruptionRow,
  updateObservationRow,
  updateSheetRow,
  type ManualSheetRow,
} from "../infrastructure/manual-repo";
import { listActivities } from "@/modules/activities/application/activity-service";
import { listStations } from "@/modules/stations/application/station-service";
import { db } from "@/lib/db";

const log = getLogger("manual-study");

// ─────────────────── DTOها ───────────────────

// ─────────────────── فهرست و جزئیات ───────────────────

export async function listManualSheets(projectId: string): Promise<ManualSheetSummaryDto[]> {
  const [rows, obsCounts, intCounts] = await Promise.all([
    listSheetRows(projectId),
    countObservationsBySheets(projectId),
    countInterruptionsBySheets(projectId),
  ]);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    statusFa: manualSheetStatusFa(r.status, (obsCounts.get(r.id) ?? 0) > 0),
    note: r.note,
    sampleCount: r.sampleCount,
    observationCount: obsCounts.get(r.id) ?? 0,
    interruptionCount: intCounts.get(r.id) ?? 0,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getManualSheet(projectId: string, sheetId: string): Promise<ManualSheetDetailDto> {
  const sheet = await findSheetById(projectId, sheetId);
  if (!sheet) throw ApiError.notFound("برگه ثبت زمان یافت نشد.");
  const [observations, interruptions, activities, stations] = await Promise.all([
    listObservationRows(sheetId),
    listInterruptionRows(sheetId),
    listActivities(projectId, true),
    listStations(projectId, true),
  ]);
  const activityById = new Map(activities.map((a) => [a.id, a]));
  const stationById = new Map(stations.map((s) => [s.id, s]));

  // گروه‌بندی مشاهده‌ها بر اساس فعالیت — به ترتیب فعالیت‌های پروژه
  const cellsByActivity = new Map<string, ManualCellDto[]>();
  for (const o of observations) {
    const arr = cellsByActivity.get(o.activityId) ?? [];
    arr.push({
      observationId: o.id,
      sampleIndex: o.sampleIndex,
      seconds: o.durationMs / 1000,
      durationMs: o.durationMs,
      source: o.source,
      note: o.note,
      outlierMarked: o.outlierMarked,
      excluded: o.excluded,
      corrected: o.corrected,
    });
    cellsByActivity.set(o.activityId, arr);
  }

  const rows: ManualSheetRowDto[] = activities
    .filter((a) => !a.archived || cellsByActivity.has(a.id))
    .map((a) => ({
      activityId: a.id,
      activityName: a.name,
      activityStableKey: a.stableKey,
      stationId: a.stationId,
      stationName: a.stationId ? (stationById.get(a.stationId)?.name ?? null) : null,
      cells: (cellsByActivity.get(a.id) ?? []).sort((x, y) => x.sampleIndex - y.sampleIndex),
    }));

  const interruptionDtos: ManualInterruptionDto[] = interruptions.map((i) => ({
    id: i.id,
    activityId: i.activityId,
    activityName: i.activityId ? (activityById.get(i.activityId)?.name ?? null) : null,
    sampleIndex: i.sampleIndex,
    reason: i.reason,
    reasonFa: i.reasonOther ? `${INTERRUPTION_REASON_LABELS_FA[i.reason as keyof typeof INTERRUPTION_REASON_LABELS_FA] ?? i.reason ?? i.reason} — ${i.reasonOther}` : (INTERRUPTION_REASON_LABELS_FA[i.reason as keyof typeof INTERRUPTION_REASON_LABELS_FA] ?? i.reason ?? i.reason),
    reasonOther: i.reasonOther,
    durationMs: i.durationMs,
    durationKnown: i.durationMs !== null,
    note: i.note,
    recordedAt: i.recordedAt.toISOString(),
  }));

  return {
    id: sheet.id,
    title: sheet.title,
    status: sheet.status,
    statusFa: manualSheetStatusFa(sheet.status, observations.length > 0),
    note: sheet.note,
    sampleCount: sheet.sampleCount,
    observationCount: observations.length,
    interruptionCount: interruptions.length,
    rows,
    interruptions: interruptionDtos,
    createdAt: sheet.createdAt.toISOString(),
    updatedAt: sheet.updatedAt.toISOString(),
  };
}

// ─────────────────── ایجاد و به‌روزرسانی برگه ───────────────────

export interface CreateSheetInput {
  projectId: string;
  userId: string;
  title: string;
  note?: string;
}

export async function createManualSheet(input: CreateSheetInput): Promise<ManualSheetSummaryDto> {
  const title = input.title?.trim();
  if (!title) throw ApiError.badRequest("عنوان برگه ثبت الزامی است.");
  const id = uuidv7();
  await insertSheetRow({ id, projectId: input.projectId, title, note: input.note?.trim() || null, createdBy: input.userId });
  await recordAudit({
    userId: input.userId,
    action: AUDIT_ACTIONS.manualSheetCreated,
    entityType: "ManualSheet",
    entityId: id,
    projectId: input.projectId,
    after: { title },
  });
  log.info("manual sheet created", { projectId: input.projectId, sheetId: id });
  const sheets = await listManualSheets(input.projectId);
  return sheets.find((s) => s.id === id) ?? { id, title, status: "draft", statusFa: "پیش‌نویس", note: null, sampleCount: 0, observationCount: 0, interruptionCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export interface UpdateSheetInput {
  projectId: string;
  userId: string;
  sheetId: string;
  title?: string;
  note?: string | null;
}

export async function updateManualSheet(input: UpdateSheetInput): Promise<ManualSheetSummaryDto> {
  const sheet = await findSheetById(input.projectId, input.sheetId);
  if (!sheet) throw ApiError.notFound("برگه ثبت زمان یافت نشد.");
  const data: Partial<{ title: string; note: string | null }> = {};
  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t) throw ApiError.badRequest("عنوان برگه نمی‌تواند خالی باشد.");
    if (t !== sheet.title) data.title = t;
  }
  if (input.note !== undefined) {
    const n = input.note?.trim() || null;
    if (n !== sheet.note) data.note = n;
  }
  if (Object.keys(data).length > 0) {
    await updateSheetRow(input.projectId, input.sheetId, data);
    await recordAudit({
      userId: input.userId,
      action: AUDIT_ACTIONS.manualSheetUpdated,
      entityType: "ManualSheet",
      entityId: input.sheetId,
      projectId: input.projectId,
      before: { title: sheet.title, note: sheet.note },
      after: data,
    });
  }
  const sheets = await listManualSheets(input.projectId);
  const found = sheets.find((s) => s.id === input.sheetId);
  if (!found) throw ApiError.internal();
  return found;
}

// ─────────────────── ذخیره دسته‌ای سلول‌ها ───────────────────

export interface SaveCellInput {
  activityId: string;
  sampleIndex: number;
  /** مقدار خام کاربر (رشته) — با parseDurationMs تجزیه می‌شود */
  value?: string;
  /** مقدار از پیش تجزیه‌شده (ms) — برای مسیر درون‌ریزی */
  durationMs?: number;
  note?: string | null;
}

/**
 * ذخیره دسته‌ای سلول‌های جدول — upsert روی (activityId, sampleIndex).
 * سلول با value خالی → حذف آن سلول.
 * برگه نهایی‌شده فقط از مسیر «اصلاح با دلیل» قابل تغییر است (قفل تحلیل).
 */
export async function saveSheetCells(
  projectId: string,
  sheetId: string,
  userId: string,
  cells: SaveCellInput[],
  source = "manual",
): Promise<SaveCellsResult> {
  const sheet = await findSheetById(projectId, sheetId);
  if (!sheet) throw ApiError.notFound("برگه ثبت زمان یافت نشد.");
  if (sheet.status === "finalized") {
    throw ApiError.forbidden("این برگه نهایی شده و در تحلیل است — برای تغییر مقدار از «اصلاح با دلیل» استفاده کنید.");
  }
  if (cells.length > 2000) throw ApiError.badRequest("حجم داده یک‌باره بیش از حد مجاز است — در چند مرحله ذخیره کنید.");
  if (!isObservationSource(source)) throw ApiError.badRequest("منبع ثبت نامعتبر است.");

  const activities = await listActivities(projectId, false);
  const activityIds = new Set(activities.map((a) => a.id));

  const rejected: Array<{ activityId: string; sampleIndex: number; reasonFa: string }> = [];
  const toUpsert: Array<{ id: string; sheetId: string; activityId: string; sampleIndex: number; durationMs: number; source: string; note: string | null; recordedBy: string }> = [];
  const toRemove: Array<{ activityId: string; sampleIndex: number }> = [];

  for (const cell of cells) {
    if (!activityIds.has(cell.activityId)) {
      rejected.push({ activityId: cell.activityId, sampleIndex: cell.sampleIndex, reasonFa: "فعالیت در این پروژه یافت نشد یا بایگانی است." });
      continue;
    }
    try {
      assertSampleIndex(cell.sampleIndex);
    } catch (e) {
      rejected.push({ activityId: cell.activityId, sampleIndex: cell.sampleIndex, reasonFa: (e as Error).message });
      continue;
    }
    const rawEmpty = cell.value === undefined || cell.value === null || String(cell.value).trim() === "";
    if (rawEmpty && cell.durationMs === undefined) {
      toRemove.push({ activityId: cell.activityId, sampleIndex: cell.sampleIndex });
      continue;
    }
    let ms: number;
    if (cell.durationMs !== undefined) {
      if (!Number.isFinite(cell.durationMs) || cell.durationMs <= 0 || cell.durationMs > 24 * 3600 * 1000) {
        rejected.push({ activityId: cell.activityId, sampleIndex: cell.sampleIndex, reasonFa: "مقدار میلی‌ثانیه نامعتبر است." });
        continue;
      }
      ms = Math.round(cell.durationMs);
    } else {
      const parsed = parseDurationMs(String(cell.value));
      if (!parsed.ok) {
        rejected.push({ activityId: cell.activityId, sampleIndex: cell.sampleIndex, reasonFa: parsed.messageFa });
        continue;
      }
      ms = parsed.ms;
    }
    toUpsert.push({
      id: uuidv7(),
      sheetId,
      activityId: cell.activityId,
      sampleIndex: cell.sampleIndex,
      durationMs: ms,
      source,
      note: cell.note?.trim() || null,
      recordedBy: userId,
    });
  }

  let removed = 0;
  if (toRemove.length > 0) removed = await deleteObservationRows(sheetId, toRemove);
  for (const u of toUpsert) {
    await db.manualObservation.upsert({
      where: { sheetId_activityId_sampleIndex: { sheetId: u.sheetId, activityId: u.activityId, sampleIndex: u.sampleIndex } },
      create: u,
      update: { durationMs: u.durationMs, note: u.note },
    });
  }

  // به‌روزرسانی تعداد ستون نمونه (حداکثر sampleIndex موجود)
  const maxSample = toUpsert.reduce((m, u) => Math.max(m, u.sampleIndex), 0);
  const newSampleCount = Math.min(Math.max(sheet.sampleCount, maxSample), MAX_SAMPLES);
  if (newSampleCount !== sheet.sampleCount) {
    await updateSheetRow(projectId, sheetId, { sampleCount: newSampleCount });
  }

  if (toUpsert.length + removed > 0) {
    await recordAudit({
      userId,
      action: AUDIT_ACTIONS.manualObservationSaved,
      entityType: "ManualSheet",
      entityId: sheetId,
      projectId,
      after: { saved: toUpsert.length, removed, source },
    });
  }
  log.info("sheet cells saved", { projectId, sheetId, saved: toUpsert.length, removed, rejected: rejected.length });
  return { saved: toUpsert.length, removed, rejected, sampleCount: newSampleCount };
}

/** تنظیم تعداد ستون نمونه — با کاهش، مشاهدات اضافی حذف می‌شوند (با شمارش شفاف) */
export async function setSheetSampleCount(
  projectId: string,
  sheetId: string,
  userId: string,
  sampleCount: number,
): Promise<{ sampleCount: number; removedObservations: number }> {
  const sheet = await findSheetById(projectId, sheetId);
  if (!sheet) throw ApiError.notFound("برگه ثبت زمان یافت نشد.");
  if (sheet.status === "finalized") throw ApiError.forbidden("برگه نهایی‌شده قابل تغییر نیست.");
  if (!Number.isInteger(sampleCount) || sampleCount < 0 || sampleCount > MAX_SAMPLES) {
    throw ApiError.badRequest(`تعداد نمونه باید بین ۰ تا ${MAX_SAMPLES} باشد.`);
  }
  const removed = await deleteObservationsBeyondSamples(sheetId, sampleCount);
  await updateSheetRow(projectId, sheetId, { sampleCount });
  if (removed > 0 || sampleCount !== sheet.sampleCount) {
    await recordAudit({
      userId,
      action: AUDIT_ACTIONS.manualSheetUpdated,
      entityType: "ManualSheet",
      entityId: sheetId,
      projectId,
      before: { sampleCount: sheet.sampleCount },
      after: { sampleCount, removedObservations: removed },
    });
  }
  return { sampleCount, removedObservations: removed };
}

// ─────────────────── اصلاح مشاهده (با دلیل) ───────────────────

export interface CorrectObservationInput {
  projectId: string;
  sheetId: string;
  observationId: string;
  userId: string;
  value?: string;
  durationMs?: number;
  reason?: string;
}

/**
 * اصلاح مقدار یک مشاهده — پیش از نهایی‌سازی دلیل اختیاری؛ پس از آن الزامی.
 * تاریخچه: قبل/بعد در ممیزی ثبت می‌شود؛ رکورد corrected=true می‌گیرد.
 */
export async function correctObservation(input: CorrectObservationInput): Promise<ManualSheetDetailDto> {
  const sheet = await findSheetById(input.projectId, input.sheetId);
  if (!sheet) throw ApiError.notFound("برگه ثبت زمان یافت نشد.");
  const obs = await findObservationById(input.sheetId, input.observationId);
  if (!obs) throw ApiError.notFound("مشاهده یافت نشد.");

  let ms: number;
  if (input.durationMs !== undefined) {
    if (!Number.isFinite(input.durationMs) || input.durationMs <= 0) throw ApiError.badRequest("مقدار اصلاحی نامعتبر است.");
    ms = Math.round(input.durationMs);
  } else {
    const parsed = parseDurationMs(String(input.value ?? ""));
    if (!parsed.ok) throw ApiError.badRequest(parsed.messageFa);
    ms = parsed.ms;
  }
  if (ms === obs.durationMs) {
    return getManualSheet(input.projectId, input.sheetId);
  }
  const reason = input.reason?.trim() || null;
  if (sheet.status === "finalized" && !reason) {
    throw ApiError.badRequest("برگه نهایی‌شده است — ثبت دلیل اصلاح الزامی است.");
  }
  await updateObservationRow(input.observationId, {
    durationMs: ms,
    corrected: true,
    lastEditReason: reason,
  });
  await recordAudit({
    userId: input.userId,
    action: AUDIT_ACTIONS.manualObservationCorrected,
    entityType: "ManualObservation",
    entityId: input.observationId,
    projectId: input.projectId,
    before: { durationMs: obs.durationMs, sampleIndex: obs.sampleIndex },
    after: { durationMs: ms, reason },
  });
  log.info("observation corrected", { projectId: input.projectId, observationId: input.observationId });
  return getManualSheet(input.projectId, input.sheetId);
}

// ─────────────────── علامت‌گذاری تحلیللی ───────────────────

export interface MarkObservationInput {
  projectId: string;
  sheetId: string;
  observationId: string;
  userId: string;
  outlierMarked: boolean;
  excluded: boolean;
  reason?: string;
}

/** علامت «داده پرت» و «حذف از محاسبه» — دو عمل جدا؛ حذف نیازمند علت (هم‌ارز قواعد تحلیل). */
export async function setObservationMark(input: MarkObservationInput): Promise<ManualSheetDetailDto> {
  const sheet = await findSheetById(input.projectId, input.sheetId);
  if (!sheet) throw ApiError.notFound("برگه ثبت زمان یافت نشد.");
  const obs = await findObservationById(input.sheetId, input.observationId);
  if (!obs) throw ApiError.notFound("مشاهده یافت نشد.");
  if (input.excluded && !(input.reason?.trim())) {
    throw ApiError.badRequest("حذف از محاسبه نیازمند ثبت علت است.");
  }
  const reason = input.reason?.trim() || null;
  await updateObservationRow(input.observationId, {
    outlierMarked: input.outlierMarked,
    excluded: input.excluded,
    markReason: reason,
  });
  await recordAudit({
    userId: input.userId,
    action: AUDIT_ACTIONS.manualObservationMarked,
    entityType: "ManualObservation",
    entityId: input.observationId,
    projectId: input.projectId,
    before: { outlierMarked: obs.outlierMarked, excluded: obs.excluded },
    after: { outlierMarked: input.outlierMarked, excluded: input.excluded, reason },
  });
  return getManualSheet(input.projectId, input.sheetId);
}

// ─────────────────── وقفه‌ها ───────────────────

export interface AddInterruptionInput {
  projectId: string;
  sheetId: string;
  userId: string;
  activityId?: string | null;
  reason: string;
  reasonOther?: string | null;
  durationValue?: string | null;
  durationKnown?: boolean;
  note?: string;
  sampleIndex?: number | null;
}

export async function addInterruption(input: AddInterruptionInput): Promise<ManualSheetDetailDto> {
  const sheet = await findSheetById(input.projectId, input.sheetId);
  if (!sheet) throw ApiError.notFound("برگه ثبت زمان یافت نشد.");
  if (sheet.status === "finalized") throw ApiError.forbidden("برگه نهایی‌شده — وقفه جدید قابل افزودن نیست؛ ابتدا وضعیت را بازگردانید.");

  const v = validateInterruptionReason(input.reason, input.reasonOther);
  if (!v.ok) throw ApiError.badRequest(v.messageFa);

  // مدت: نامشخص مجاز است — هیچ عدد ساختگی ساخته نمی‌شود
  let durationMs: number | null = null;
  if (input.durationKnown !== false && input.durationValue !== undefined && input.durationValue !== null && String(input.durationValue).trim() !== "") {
    const parsed = parseDurationMs(String(input.durationValue));
    if (!parsed.ok) throw ApiError.badRequest(`مدت وقفه: ${parsed.messageFa}`);
    durationMs = parsed.ms;
  }

  let activityId: string | null = null;
  if (input.activityId) {
    const activities = await listActivities(input.projectId, false);
    if (!activities.some((a) => a.id === input.activityId)) throw ApiError.badRequest("فعالیت مرتبط یافت نشد.");
    activityId = input.activityId;
  }
  let sampleIndex: number | null = null;
  if (input.sampleIndex !== undefined && input.sampleIndex !== null) {
    try {
      sampleIndex = assertSampleIndex(input.sampleIndex);
    } catch (e) {
      throw ApiError.badRequest((e as Error).message);
    }
  }

  const id = uuidv7();
  await insertInterruptionRow({
    id,
    sheetId: input.sheetId,
    activityId,
    reason: v.reason,
    reasonOther: v.reasonOther,
    durationMs,
    note: input.note?.trim() || null,
    sampleIndex,
    recordedBy: input.userId,
  });
  await recordAudit({
    userId: input.userId,
    action: AUDIT_ACTIONS.manualInterruptionAdded,
    entityType: "ManualInterruption",
    entityId: id,
    projectId: input.projectId,
    after: { reason: v.reason, reasonOther: v.reasonOther, durationMs, activityId },
  });
  return getManualSheet(input.projectId, input.sheetId);
}

export interface UpdateInterruptionInput {
  projectId: string;
  sheetId: string;
  interruptionId: string;
  userId: string;
  activityId?: string | null;
  reason?: string;
  reasonOther?: string | null;
  durationValue?: string | null;
  durationKnown?: boolean;
  note?: string;
  sampleIndex?: number | null;
}

export async function updateInterruption(input: UpdateInterruptionInput): Promise<ManualSheetDetailDto> {
  const sheet = await findSheetById(input.projectId, input.sheetId);
  if (!sheet) throw ApiError.notFound("برگه ثبت زمان یافت نشد.");
  const row = await findInterruptionById(input.sheetId, input.interruptionId);
  if (!row) throw ApiError.notFound("وقفه یافت نشد.");

  const data: Partial<{ activityId: string | null; reason: string; reasonOther: string | null; durationMs: number | null; note: string | null; sampleIndex: number | null }> = {};

  if (input.reason !== undefined || input.reasonOther !== undefined) {
    const nextReason = input.reason ?? row.reason;
    const nextOther = input.reasonOther !== undefined ? input.reasonOther : row.reasonOther;
    const v = validateInterruptionReason(nextReason, nextOther);
    if (!v.ok) throw ApiError.badRequest(v.messageFa);
    if (v.reason !== row.reason) data.reason = v.reason;
    if (v.reasonOther !== row.reasonOther) data.reasonOther = v.reasonOther;
  }
  if (input.durationKnown !== undefined || input.durationValue !== undefined) {
    if (input.durationKnown === false) {
      if (row.durationMs !== null) data.durationMs = null;
    } else {
      const raw = input.durationValue !== undefined ? input.durationValue : (row.durationMs !== null ? String(row.durationMs / 1000) : "");
      if (String(raw).trim() === "") {
        if (row.durationMs !== null) data.durationMs = null;
      } else {
        const parsed = parseDurationMs(String(raw));
        if (!parsed.ok) throw ApiError.badRequest(`مدت وقفه: ${parsed.messageFa}`);
        if (parsed.ms !== row.durationMs) data.durationMs = parsed.ms;
      }
    }
  }
  if (input.note !== undefined) {
    const n = input.note?.trim() || null;
    if (n !== row.note) data.note = n;
  }
  if (input.sampleIndex !== undefined) {
    if (input.sampleIndex === null) {
      data.sampleIndex = null;
    } else {
      try {
        data.sampleIndex = assertSampleIndex(input.sampleIndex);
      } catch (e) {
        throw ApiError.badRequest((e as Error).message);
      }
    }
  }
  if (input.activityId !== undefined) {
    data.activityId = input.activityId || null;
  }

  if (Object.keys(data).length > 0) {
    await updateInterruptionRow(input.interruptionId, data);
    await recordAudit({
      userId: input.userId,
      action: AUDIT_ACTIONS.manualInterruptionUpdated,
      entityType: "ManualInterruption",
      entityId: input.interruptionId,
      projectId: input.projectId,
      before: { reason: row.reason, durationMs: row.durationMs, note: row.note },
      after: data,
    });
  }
  return getManualSheet(input.projectId, input.sheetId);
}

export async function removeInterruption(projectId: string, sheetId: string, interruptionId: string, userId: string): Promise<ManualSheetDetailDto> {
  const sheet = await findSheetById(projectId, sheetId);
  if (!sheet) throw ApiError.notFound("برگه ثبت زمان یافت نشد.");
  const row = await findInterruptionById(sheetId, interruptionId);
  if (!row) throw ApiError.notFound("وقفه یافت نشد.");
  if (sheet.status === "finalized") throw ApiError.forbidden("برگه نهایی‌شده — وقفه قابل حذف نیست.");
  await deleteInterruptionRow(interruptionId);
  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.manualInterruptionRemoved,
    entityType: "ManualInterruption",
    entityId: interruptionId,
    projectId,
    before: { reason: row.reason, reasonOther: row.reasonOther, durationMs: row.durationMs },
  });
  return getManualSheet(projectId, sheetId);
}

// ─────────────────── چرخه وضعیت برگه ───────────────────

export async function setSheetStatus(
  projectId: string,
  sheetId: string,
  userId: string,
  status: string,
  reason?: string,
): Promise<ManualSheetSummaryDto> {
  const sheet = await findSheetById(projectId, sheetId);
  if (!sheet) throw ApiError.notFound("برگه ثبت زمان یافت نشد.");
  if (!isManualSheetStatus(status)) throw ApiError.badRequest("وضعیت برگه نامعتبر است.");
  if (status === "finalized") {
    const count = await countObservations(sheetId);
    if (count === 0) throw ApiError.badRequest("برگه خالی است — پیش از ارسال به تحلیل باید زمان‌ها ثبت شوند.");
  }
  if (sheet.status === "finalized" && status !== "finalized" && !(reason?.trim())) {
    throw ApiError.badRequest("بازگردانی برگه نهایی‌شده نیازمند ثبت دلیل است.");
  }
  if (sheet.status === status) {
    const sheets = await listManualSheets(projectId);
    const same = sheets.find((s) => s.id === sheetId);
    if (!same) throw ApiError.internal();
    return same;
  }
  await updateSheetRow(projectId, sheetId, { status });
  await recordAudit({
    userId,
    action: status === "finalized" ? AUDIT_ACTIONS.manualSheetFinalized : AUDIT_ACTIONS.manualSheetUpdated,
    entityType: "ManualSheet",
    entityId: sheetId,
    projectId,
    before: { status: sheet.status },
    after: { status, reason: reason?.trim() || null },
  });
  log.info("sheet status changed", { projectId, sheetId, from: sheet.status, to: status });
  const sheets = await listManualSheets(projectId);
  const found = sheets.find((s) => s.id === sheetId);
  if (!found) throw ApiError.internal();
  return found;
}

/** حذف برگه (فقط پیش‌نویس بدون داده) — با داده فقط بایگانی منطقی از طریق وضعیت */
export async function deleteManualSheet(projectId: string, sheetId: string, userId: string): Promise<void> {
  const sheet = await findSheetById(projectId, sheetId);
  if (!sheet) throw ApiError.notFound("برگه ثبت زمان یافت نشد.");
  if (sheet.status === "finalized") throw ApiError.forbidden("برگه نهایی‌شده در تحلیل استفاده می‌شود و قابل حذف نیست.");
  const count = await countObservations(sheetId);
  if (count > 0) throw ApiError.badRequest("این برگه داده ثبت‌شده دارد — برای حفظ سوابق، آن را نهایی نکنید و بدون ذخیره رها کنید یا داده‌ها را پاک کنید.");
  await db.manualInterruption.deleteMany({ where: { sheetId } });
  await db.manualSheet.delete({ where: { id: sheetId } });
  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.manualSheetUpdated,
    entityType: "ManualSheet",
    entityId: sheetId,
    projectId,
    before: { title: sheet.title, deleted: true },
  });
}
