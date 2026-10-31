/**
 * زیرساخت ماژول زمان‌سنجی — Prisma.
 *  - رویدادها append-only: فقط insert؛ هرگز update/delete.
 *  - idempotency با unique(clientEventId) — تکراری skip می‌شود (نه خطا).
 */

import { db } from "@/lib/db";

export interface TimingSessionRow {
  id: string;
  projectId: string;
  method: string;
  status: string;
  observer: string;
  elementsJson: string;
  elementAdvanceMode: string;
  tolerancePct: number;
  elementSource: string;
  diagramRefId: string | null;
  diagramRefNote: string | null;
  integrityFlagsJson: string | null;
  notes: string | null;
  startedAtWall: Date | null;
  endedAtWall: Date | null;
  deviceMetaJson: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimingEventRow {
  id: string;
  sessionId: string;
  clientEventId: string;
  seq: number;
  type: string;
  elementId: string | null;
  cycleNo: number;
  elapsedActiveMs: number;
  splitMs: number | null;
  wallClock: Date;
  note: string | null;
  interruptionReason: string | null;
  correctionOf: string | null;
  correctedValueMs: number | null;
  correctionReason: string | null;
  integrityJson: string | null;
  origin: string;
  receivedBy: string;
  receivedAt: Date;
}

export interface TimingCycleRow {
  id: string;
  sessionId: string;
  seq: number;
  status: string;
  startedAtEventId: string;
  endedAtEventId: string | null;
  startedElapsedMs: number;
  endedElapsedMs: number | null;
  cycleTimeMs: number | null;
  elementsSumMs: number;
  deviationPct: number | null;
  elementsJson: string;
  interruptionsJson: string;
  flagsJson: string | null;
  createdAt: Date;
}

// ─────────────────────── جلسه‌ها ───────────────────────

export async function insertSessionRow(input: {
  id: string;
  projectId: string;
  method: string;
  status: string;
  observer: string;
  elementsJson: string;
  elementAdvanceMode: string;
  tolerancePct: number;
  elementSource: string;
  diagramRefId: string | null;
  diagramRefNote: string | null;
  notes: string | null;
  deviceMetaJson: string | null;
  createdBy: string;
}): Promise<TimingSessionRow> {
  return db.timingSession.create({ data: input });
}

export async function listSessionRows(projectId: string): Promise<TimingSessionRow[]> {
  return db.timingSession.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
}

export async function findSessionRow(projectId: string, sessionId: string): Promise<TimingSessionRow | null> {
  return db.timingSession.findFirst({ where: { id: sessionId, projectId } });
}

export async function updateSessionRow(
  sessionId: string,
  patch: Partial<Pick<TimingSessionRow, "status" | "notes" | "startedAtWall" | "endedAtWall" | "integrityFlagsJson">>,
): Promise<TimingSessionRow> {
  return db.timingSession.update({ where: { id: sessionId }, data: patch });
}

export async function countSessionEvents(sessionId: string): Promise<number> {
  return db.timingEvent.count({ where: { sessionId } });
}

export async function countSessionCycles(sessionId: string): Promise<number> {
  return db.timingCycle.count({ where: { sessionId } });
}

// ─────────────────────── رویدادها (append-only) ───────────────────────

export async function listEventRows(sessionId: string): Promise<TimingEventRow[]> {
  return db.timingEvent.findMany({ where: { sessionId }, orderBy: { seq: "asc" } });
}

export async function findEventByClientEventId(sessionId: string, clientEventId: string): Promise<TimingEventRow | null> {
  return db.timingEvent.findFirst({ where: { sessionId, clientEventId } });
}

export async function maxEventSeq(sessionId: string): Promise<number> {
  const row = await db.timingEvent.findFirst({ where: { sessionId }, orderBy: { seq: "desc" }, select: { seq: true } });
  return row?.seq ?? 0;
}

export interface InsertEventInput {
  id: string;
  sessionId: string;
  clientEventId: string;
  seq: number;
  type: string;
  elementId: string | null;
  cycleNo: number;
  elapsedActiveMs: number;
  splitMs: number | null;
  wallClock: Date;
  note: string | null;
  interruptionReason: string | null;
  correctionOf: string | null;
  correctedValueMs: number | null;
  correctionReason: string | null;
  integrityJson: string | null;
  origin: string;
  receivedBy: string;
}

/**
 * درج idempotent یک رویداد — تکراری (clientEventId همان) skip؛
 * تداخل seq با شناسه متفاوت → رد با علت (قرارداد صریح).
 */
export async function insertEventRow(
  input: InsertEventInput,
): Promise<{ outcome: "inserted" | "duplicate" } | { outcome: "seq-conflict"; existingClientEventId: string }> {
  const existing = await findEventByClientEventId(input.sessionId, input.clientEventId);
  if (existing) return { outcome: "duplicate" };

  const seqOwner = await db.timingEvent.findFirst({
    where: { sessionId: input.sessionId, seq: input.seq },
    select: { clientEventId: true },
  });
  if (seqOwner && seqOwner.clientEventId !== input.clientEventId) {
    return { outcome: "seq-conflict", existingClientEventId: seqOwner.clientEventId };
  }

  await db.timingEvent.create({ data: input });
  return { outcome: "inserted" };
}

// ─────────────────────── چرخه‌های نهایی‌شده ───────────────────────

export async function replaceCycleRows(
  sessionId: string,
  rows: Array<Omit<TimingCycleRow, "id" | "sessionId" | "createdAt">>,
): Promise<void> {
  await db.$transaction([
    db.timingCycle.deleteMany({ where: { sessionId } }),
    ...rows.map((r) =>
      db.timingCycle.create({
        data: {
          id: crypto.randomUUID(),
          sessionId,
          seq: r.seq,
          status: r.status,
          startedAtEventId: r.startedAtEventId,
          endedAtEventId: r.endedAtEventId,
          startedElapsedMs: r.startedElapsedMs,
          endedElapsedMs: r.endedElapsedMs,
          cycleTimeMs: r.cycleTimeMs,
          elementsSumMs: r.elementsSumMs,
          deviationPct: r.deviationPct,
          elementsJson: r.elementsJson,
          interruptionsJson: r.interruptionsJson,
          flagsJson: r.flagsJson,
        },
      }),
    ),
  ]);
}

export async function listCycleRows(sessionId: string): Promise<TimingCycleRow[]> {
  return db.timingCycle.findMany({ where: { sessionId }, orderBy: { seq: "asc" } });
}
