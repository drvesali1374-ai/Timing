/**
 * زیرساخت ماژول مطالعه دستی — Prisma (ADR-017).
 */

import { db } from "@/lib/db";

export interface ManualSheetRow {
  id: string;
  projectId: string;
  title: string;
  status: string;
  note: string | null;
  sampleCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function listSheetRows(projectId: string): Promise<ManualSheetRow[]> {
  return db.manualSheet.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

export async function findSheetById(projectId: string, id: string): Promise<ManualSheetRow | null> {
  return db.manualSheet.findFirst({ where: { id, projectId } });
}

export async function listFinalizedSheetRows(projectId: string): Promise<ManualSheetRow[]> {
  return db.manualSheet.findMany({
    where: { projectId, status: "finalized" },
    orderBy: { createdAt: "asc" },
  });
}

export async function insertSheetRow(input: {
  id: string;
  projectId: string;
  title: string;
  note: string | null;
  createdBy: string;
}): Promise<ManualSheetRow> {
  return db.manualSheet.create({ data: { ...input, status: "draft", sampleCount: 0 } });
}

export async function updateSheetRow(
  projectId: string,
  id: string,
  data: Partial<{ title: string; note: string | null; status: string; sampleCount: number }>,
): Promise<void> {
  await db.manualSheet.update({ where: { id }, data });
}

// ─────────────────── مشاهدات ───────────────────

export interface ManualObservationRow {
  id: string;
  sheetId: string;
  activityId: string;
  sampleIndex: number;
  durationMs: number;
  source: string;
  note: string | null;
  outlierMarked: boolean;
  excluded: boolean;
  markReason: string | null;
  lastEditReason: string | null;
  corrected: boolean;
  recordedBy: string;
  recordedAt: Date;
  updatedAt: Date;
}

export async function listObservationRows(sheetId: string): Promise<ManualObservationRow[]> {
  return db.manualObservation.findMany({
    where: { sheetId },
    orderBy: [{ activityId: "asc" }, { sampleIndex: "asc" }],
  });
}

export async function listObservationRowsForSheets(sheetIds: string[]): Promise<ManualObservationRow[]> {
  if (sheetIds.length === 0) return [];
  return db.manualObservation.findMany({
    where: { sheetId: { in: sheetIds } },
    orderBy: [{ sheetId: "asc" }, { activityId: "asc" }, { sampleIndex: "asc" }],
  });
}

export async function findObservationById(sheetId: string, id: string): Promise<ManualObservationRow | null> {
  return db.manualObservation.findFirst({ where: { id, sheetId } });
}

export async function upsertObservationRow(input: {
  id: string;
  sheetId: string;
  activityId: string;
  sampleIndex: number;
  durationMs: number;
  source: string;
  note: string | null;
  recordedBy: string;
}): Promise<void> {
  await db.manualObservation.upsert({
    where: {
      sheetId_activityId_sampleIndex: {
        sheetId: input.sheetId,
        activityId: input.activityId,
        sampleIndex: input.sampleIndex,
      },
    },
    create: {
      id: input.id,
      sheetId: input.sheetId,
      activityId: input.activityId,
      sampleIndex: input.sampleIndex,
      durationMs: input.durationMs,
      source: input.source,
      note: input.note,
      recordedBy: input.recordedBy,
    },
    update: {
      durationMs: input.durationMs,
      note: input.note,
    },
  });
}

export async function updateObservationRow(
  id: string,
  data: Partial<{ durationMs: number; note: string | null; outlierMarked: boolean; excluded: boolean; markReason: string | null; lastEditReason: string | null; corrected: boolean }>,
): Promise<void> {
  await db.manualObservation.update({ where: { id }, data });
}

export async function deleteObservationRows(sheetId: string, keys: Array<{ activityId: string; sampleIndex: number }>): Promise<number> {
  if (keys.length === 0) return 0;
  const res = await db.manualObservation.deleteMany({
    where: {
      sheetId,
      OR: keys.map((k) => ({ activityId: k.activityId, sampleIndex: k.sampleIndex })),
    },
  });
  return res.count;
}

/** حذف مشاهدات خارج از محدوده نمونه‌های فعلی (پس از کاهش تعداد ستون) */
export async function deleteObservationsBeyondSamples(sheetId: string, sampleCount: number): Promise<number> {
  const res = await db.manualObservation.deleteMany({
    where: { sheetId, sampleIndex: { gt: sampleCount } },
  });
  return res.count;
}

export async function countObservations(sheetId: string): Promise<number> {
  return db.manualObservation.count({ where: { sheetId } });
}

export async function countObservationsBySheets(projectId: string): Promise<Map<string, number>> {
  const rows = await db.manualObservation.groupBy({
    by: ["sheetId"],
    where: { sheet: { projectId } },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.sheetId, r._count._all);
  return map;
}

// ─────────────────── وقفه‌ها ───────────────────

export interface ManualInterruptionRow {
  id: string;
  sheetId: string;
  activityId: string | null;
  reason: string;
  reasonOther: string | null;
  durationMs: number | null;
  note: string | null;
  sampleIndex: number | null;
  recordedBy: string;
  recordedAt: Date;
  updatedAt: Date;
}

export async function listInterruptionRows(sheetId: string): Promise<ManualInterruptionRow[]> {
  return db.manualInterruption.findMany({
    where: { sheetId },
    orderBy: { recordedAt: "desc" },
  });
}

export async function countInterruptionsBySheets(projectId: string): Promise<Map<string, number>> {
  const rows = await db.manualInterruption.groupBy({
    by: ["sheetId"],
    where: { sheet: { projectId } },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.sheetId, r._count._all);
  return map;
}

export async function insertInterruptionRow(input: {
  id: string;
  sheetId: string;
  activityId: string | null;
  reason: string;
  reasonOther: string | null;
  durationMs: number | null;
  note: string | null;
  sampleIndex: number | null;
  recordedBy: string;
}): Promise<void> {
  await db.manualInterruption.create({ data: input });
}

export async function findInterruptionById(sheetId: string, id: string): Promise<ManualInterruptionRow | null> {
  return db.manualInterruption.findFirst({ where: { id, sheetId } });
}

export async function updateInterruptionRow(
  id: string,
  data: Partial<{ activityId: string | null; reason: string; reasonOther: string | null; durationMs: number | null; note: string | null; sampleIndex: number | null }>,
): Promise<void> {
  await db.manualInterruption.update({ where: { id }, data });
}

export async function deleteInterruptionRow(id: string): Promise<void> {
  await db.manualInterruption.delete({ where: { id } });
}
