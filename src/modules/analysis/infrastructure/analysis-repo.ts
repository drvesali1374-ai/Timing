/**
 * زیرساخت ماژول تحلیل — دسترسی Prisma (فاز ۵).
 *  - خواندن جلسات نهایی‌شده + چرخه‌های ذخیره‌شده (ورودی پایدار تحلیل)
 *  - علامت‌های مشاهده: append-only + آخرین حالت هر مشاهده + تاریخچه کامل
 *  - زمینه جلسه: مقدار پارامتر scopeType=session (بند ۶ فاز ۵)
 */

import { db } from "@/lib/db";

// ─────────────────────── ردیف‌ها ───────────────────────

export interface FinalizedSessionRow {
  id: string;
  projectId: string;
  method: string;
  status: string;
  observer: string;
  elementSource: string;
  tolerancePct: number;
  elementsJson: string;
  startedAtWall: Date | null;
  endedAtWall: Date | null;
  createdAt: Date;
}

export interface StoredCycleRow {
  sessionId: string;
  seq: number;
  status: string;
  cycleTimeMs: number | null;
  elementsSumMs: number;
  deviationPct: number | null;
  elementsJson: string;
  flagsJson: string | null;
}

export interface MarkRow {
  id: string;
  sessionId: string;
  readingEventId: string;
  cycleSeq: number;
  elementKey: string;
  outlierMarked: boolean;
  excluded: boolean;
  reason: string | null;
  markedBy: string;
  createdAt: Date;
}

export interface SessionContextRow {
  /** شناسه جلسه — در Prisma ستون scopeId با scopeType=session */
  scopeId: string;
  stableKey: string;
  valueJson: string;
  updatedAt: Date;
}

// ─────────────────────── جلسات نهایی‌شده ───────────────────────

/** جلسات نهایی‌شده پروژه به ترتیب ایجاد — تنها ورودی معتبر تحلیل (قفل فاز ۴). */
export async function listFinalizedSessionRows(projectId: string): Promise<FinalizedSessionRow[]> {
  return db.timingSession.findMany({
    where: { projectId, status: "finalized" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      projectId: true,
      method: true,
      status: true,
      observer: true,
      elementSource: true,
      tolerancePct: true,
      elementsJson: true,
      startedAtWall: true,
      endedAtWall: true,
      createdAt: true,
    },
  });
}

/** چرخه‌های ذخیره‌شده یک جلسه نهایی‌شده. */
export async function listStoredCycles(sessionIds: readonly string[]): Promise<StoredCycleRow[]> {
  if (sessionIds.length === 0) return [];
  return db.timingCycle.findMany({
    where: { sessionId: { in: [...sessionIds] } },
    orderBy: [{ sessionId: "asc" }, { seq: "asc" }],
    select: {
      sessionId: true,
      seq: true,
      status: true,
      cycleTimeMs: true,
      elementsSumMs: true,
      deviationPct: true,
      elementsJson: true,
      flagsJson: true,
    },
  });
}

// ─────────────────────── علامت‌های مشاهده ───────────────────────

/** درج ردیف جدید حالت — append-only (تاریخچه حفظ می‌شود). */
export async function insertObservationMarkRow(input: {
  id: string;
  sessionId: string;
  readingEventId: string;
  cycleSeq: number;
  elementKey: string;
  outlierMarked: boolean;
  excluded: boolean;
  reason: string | null;
  markedBy: string;
}): Promise<void> {
  await db.observationMark.create({ data: input });
}

/**
 * آخرین حالت هر مشاهده (readingEventId) از میان جلسات پروژه.
 * latest-wins بر اساس createdAt؛ حالت «بی‌علامت» = ردیفی با هر دو پرچم خاموش.
 */
export async function latestMarkStates(sessionIds: readonly string[]): Promise<Map<string, MarkRow>> {
  if (sessionIds.length === 0) return new Map();
  const rows = await db.observationMark.findMany({
    where: { sessionId: { in: [...sessionIds] } },
    orderBy: { createdAt: "asc" },
  });
  const byReading = new Map<string, MarkRow>();
  for (const row of rows) {
    byReading.set(row.readingEventId, row); // آخرین برنده — ردیف‌ها به ترتیب زمان
  }
  return byReading;
}

/** تاریخچه کامل علامت‌های یک مشاهده — برای شفافیت «اثر و تاریخچه روشن» (R5-2). */
export async function markHistory(sessionId: string, readingEventId: string): Promise<MarkRow[]> {
  return db.observationMark.findMany({
    where: { sessionId, readingEventId },
    orderBy: { createdAt: "asc" },
  });
}

/** تاریخچه همه علامت‌های پروژه — پاورقی گزارش/ممیزی. */
export async function allMarkHistoryRows(sessionIds: readonly string[]): Promise<MarkRow[]> {
  if (sessionIds.length === 0) return [];
  return db.observationMark.findMany({
    where: { sessionId: { in: [...sessionIds] } },
    orderBy: { createdAt: "asc" },
  });
}

// ─────────────────────── زمینه جلسه (پارامتر سفارشی scopeType=session) ───────────────────────

/** مقادیر زمینه جلسات — scopeType=session (B2/DATA_DICTIONARY §۲٫۶). */
export async function listSessionContextRows(projectId: string, sessionIds: readonly string[]): Promise<SessionContextRow[]> {
  if (sessionIds.length === 0) return [];
  return db.parameterValue.findMany({
    where: { projectId, scopeType: "session", scopeId: { in: [...sessionIds] } },
    select: { scopeId: true, stableKey: true, valueJson: true, updatedAt: true },
  });
}

/** ثبت/به‌روزرسانی زمینه جلسه — upsert روی (projectId, stableKey, scopeType, scopeId). */
export async function upsertSessionContextRow(input: {
  id: string;
  projectId: string;
  sessionId: string;
  stableKey: string;
  defVersion: number;
  valueJson: string;
  recordedBy: string;
}): Promise<void> {
  await db.parameterValue.upsert({
    where: {
      projectId_stableKey_scopeType_scopeId: {
        projectId: input.projectId,
        stableKey: input.stableKey,
        scopeType: "session",
        scopeId: input.sessionId,
      },
    },
    create: {
      id: input.id,
      projectId: input.projectId,
      stableKey: input.stableKey,
      defVersion: input.defVersion,
      scopeType: "session",
      scopeId: input.sessionId,
      valueJson: input.valueJson,
      recordedBy: input.recordedBy,
    },
    update: {
      valueJson: input.valueJson,
      recordedBy: input.recordedBy,
      updatedAt: new Date(),
    },
  });
}
