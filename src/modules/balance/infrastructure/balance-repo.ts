/**
 * زیرساخت ماژول بالانس — دسترسی Prisma (فاز ۶).
 * سناریوها + نتایج append-only (تاریخچه کامل برای مقایسه قبل/بعد).
 */

import { db } from "@/lib/db";

export interface ScenarioRow {
  id: string;
  projectId: string;
  name: string;
  status: string;
  inputsJson: string;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResultRow {
  id: string;
  scenarioId: string;
  algorithm: string;
  algorithmVersion: string;
  status: string;
  assignmentsJson: string;
  stationsJson: string;
  metricsJson: string;
  violationsJson: string;
  notesJson: string | null;
  objectiveValue: number | null;
  runMs: number;
  createdBy: string;
  createdAt: Date;
}

export interface InsertResultInput {
  id: string;
  scenarioId: string;
  algorithm: string;
  algorithmVersion: string;
  status: string;
  assignmentsJson: string;
  stationsJson: string;
  metricsJson: string;
  violationsJson: string;
  notesJson: string | null;
  objectiveValue: number | null;
  runMs: number;
  createdBy: string;
}

// ─────────────────────── سناریوها ───────────────────────

export async function listScenarioRows(projectId: string, includeArchived = false): Promise<ScenarioRow[]> {
  return db.balanceScenario.findMany({
    where: includeArchived ? { projectId } : { projectId, status: "active" },
    orderBy: { createdAt: "desc" },
  });
}

export async function findScenarioRow(projectId: string, scenarioId: string): Promise<ScenarioRow | null> {
  return db.balanceScenario.findFirst({ where: { id: scenarioId, projectId } });
}

export async function insertScenarioRow(input: {
  id: string;
  projectId: string;
  name: string;
  inputsJson: string;
  notes: string | null;
  createdBy: string;
}): Promise<ScenarioRow> {
  return db.balanceScenario.create({ data: input });
}

export async function updateScenarioRow(
  scenarioId: string,
  patch: { name?: string; inputsJson?: string; notes?: string | null; status?: string },
): Promise<ScenarioRow> {
  return db.balanceScenario.update({ where: { id: scenarioId }, data: patch });
}

// ─────────────────────── نتایج ───────────────────────

export async function listResultRows(scenarioId: string): Promise<ResultRow[]> {
  return db.balanceResult.findMany({
    where: { scenarioId },
    orderBy: { createdAt: "desc" },
  });
}

export async function countResultRows(scenarioIds: readonly string[]): Promise<Map<string, number>> {
  const rows = await db.balanceResult.groupBy({
    by: ["scenarioId"],
    where: { scenarioId: { in: [...scenarioIds] } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.scenarioId, r._count._all]));
}

export async function insertResultRow(input: InsertResultInput): Promise<ResultRow> {
  return db.balanceResult.create({ data: input });
}

/** آخرین نتیجه هر سناریو — «وضعیت جاری» برای فهرست. */
export async function latestResultRows(scenarioIds: readonly string[]): Promise<Map<string, ResultRow>> {
  if (scenarioIds.length === 0) return new Map();
  // SQLite بدون window function در Prisma — واکشی و انتخاب در حافظه (حجم کم: هر سناریو چند ده نتیجه)
  const rows = await db.balanceResult.findMany({
    where: { scenarioId: { in: [...scenarioIds] } },
    orderBy: { createdAt: "asc" },
  });
  const map = new Map<string, ResultRow>();
  for (const r of rows) map.set(r.scenarioId, r); // asc → آخرین بازنویسی = جدیدترین
  return map;
}
