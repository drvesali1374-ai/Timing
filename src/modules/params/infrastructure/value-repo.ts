/**
 * زیرساخت ماژول پارامترها — ParameterValue + CalculationResult (Prisma).
 */

import { db } from "@/lib/db";

export interface ParamValueRow {
  id: string;
  projectId: string;
  stableKey: string;
  defVersion: number;
  scopeType: string;
  scopeId: string;
  valueJson: string;
  recordedBy: string;
  recordedAt: Date;
  updatedAt: Date;
}

export async function upsertParamValueRow(input: {
  id: string;
  projectId: string;
  stableKey: string;
  defVersion: number;
  scopeType: string;
  scopeId: string;
  valueJson: string;
  recordedBy: string;
}): Promise<void> {
  await db.parameterValue.upsert({
    where: {
      projectId_stableKey_scopeType_scopeId: {
        projectId: input.projectId,
        stableKey: input.stableKey,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
      },
    },
    update: {
      defVersion: input.defVersion,
      valueJson: input.valueJson,
      recordedBy: input.recordedBy,
    },
    create: input,
  });
}

export async function listParamValueRows(projectId: string, scopeType: string, scopeId: string): Promise<ParamValueRow[]> {
  return db.parameterValue.findMany({
    where: { projectId, scopeType, scopeId },
    orderBy: { stableKey: "asc" },
  });
}

export async function insertCalculationResultRow(input: {
  id: string;
  projectId: string;
  formulaKey: string;
  formulaSemver: string;
  configVersionId: string;
  scopeType: string;
  scopeId: string;
  valueJson: string | null;
  status: string;
  errorsJson: string | null;
  traceJson: string;
  inputRefsJson: string;
  computedBy: string;
}): Promise<void> {
  await db.calculationResult.create({ data: input });
}

export async function latestCalculationResultRows(projectId: string, limit = 200) {
  // آخرین نتیجه هر (formulaKey, scope) — با گروه‌بندی در حافظه (SQLite بدون window function پیچیده)
  const rows = await db.calculationResult.findMany({
    where: { projectId },
    orderBy: { computedAt: "desc" },
    take: limit * 4,
  });
  const seen = new Set<string>();
  const latest: typeof rows = [];
  for (const row of rows) {
    const sig = `${row.formulaKey}:${row.scopeType}:${row.scopeId}`;
    if (!seen.has(sig)) {
      seen.add(sig);
      latest.push(row);
    }
    if (latest.length >= limit) break;
  }
  return latest;
}

export async function countCalculationResults(projectId: string): Promise<number> {
  return db.calculationResult.count({ where: { projectId } });
}
