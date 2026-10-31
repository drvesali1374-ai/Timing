/**
 * لایه Application ماژول زمان‌سنجی — عملیات فاز ۴.
 *  - ایجاد جلسه (اسنپ‌شات عناصر + تلورانس)
 *  - دریافت رویدادهای batch به‌صورت idempotent (append-only)
 *  - مشتق‌سازی زنده چرخه‌ها با همان هسته مشترک کلاینت (قطعیت مشتق)
 *  - نهایی‌سازی: ذخیره چرخه‌های مشتق + قفل جلسه + رویداد finalize
 *
 * رویدادهای معمول (قرائت/مکث/...) ممیزی نمی‌شوند (سیل داده)؛ فقط چرخه عمر
 * جلسه و اصلاح‌های کاربر ممیزی می‌شوند (تصمیم ثبت‌شده در ADR-013).
 */

import { z } from "zod";
import { uuidv7 } from "@/shared/ids";
import { ApiError } from "@/shared/errors";
import { getLogger } from "@/shared/logger";
import { AUDIT_ACTIONS, recordAudit } from "@/modules/audit/application/audit-service";
import { deriveSession } from "@/shared/timing/derive";
import {
  CHRONO_EVENT_LABELS_FA,
  INTEGRITY_FLAG_LABELS_FA,
  TIMING_METHOD_LABELS_FA,
  type ChronoEvent,
  type IntegrityFlag,
  type TimingElementRef,
} from "@/shared/timing/types";
import {
  ELEMENT_SOURCE_LABELS_FA,
  SESSION_STATUS_LABELS_FA,
  createSessionSchema,
  ingestEventsSchema,
  isSessionStatus,
  patchSessionSchema,
  type AdvanceMode,
  type CreateSessionInput,
  type ElementSource,
  type FinalizeResultDto,
  type IngestEventsInput,
  type IngestResultDto,
  type SessionStatus,
  type TimingSessionDetailDto,
  type TimingSessionSummaryDto,
} from "../domain/timing";
import {
  countSessionCycles,
  countSessionEvents,
  findSessionRow,
  insertEventRow,
  insertSessionRow,
  listCycleRows,
  listEventRows,
  listSessionRows,
  maxEventSeq,
  replaceCycleRows,
  updateSessionRow,
  type TimingEventRow,
  type TimingSessionRow,
} from "../infrastructure/timing-repo";

const log = getLogger("timing");

const STATE_EVENT_STATUS: Partial<Record<string, SessionStatus>> = {
  start: "running",
  pause: "paused",
  resume: "running",
  stop: "stopped",
};

// ─────────────────────── DTO ───────────────────────

function parseElements(row: TimingSessionRow): TimingElementRef[] {
  try {
    const parsed = JSON.parse(row.elementsJson) as TimingElementRef[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rowToEventDto(row: TimingEventRow): ChronoEvent {
  return {
    clientEventId: row.clientEventId,
    sessionId: row.sessionId,
    seq: row.seq,
    type: row.type as ChronoEvent["type"],
    ...(row.elementId !== null ? { elementId: row.elementId } : {}),
    cycleNo: row.cycleNo,
    elapsedActiveMs: row.elapsedActiveMs,
    ...(row.splitMs !== null ? { splitMs: row.splitMs } : {}),
    wallClock: row.wallClock.toISOString(),
    ...(row.note !== null ? { note: row.note } : {}),
    ...(row.interruptionReason !== null ? { interruptionReason: row.interruptionReason } : {}),
    ...(row.correctionOf !== null ? { correctionOf: row.correctionOf } : {}),
    ...(row.correctedValueMs !== null ? { correctedValueMs: row.correctedValueMs } : {}),
    ...(row.correctionReason !== null ? { correctionReason: row.correctionReason } : {}),
    ...(row.integrityJson ? { integrity: JSON.parse(row.integrityJson) as IntegrityFlag[] } : {}),
  };
}

async function toSummaryDto(row: TimingSessionRow): Promise<TimingSessionSummaryDto> {
  const [eventCount, cycleCount] = await Promise.all([countSessionEvents(row.id), countSessionCycles(row.id)]);
  // وضعیت نمایشی: اگر جلسه finalized است چرخه‌های ذخیره‌شده شمارش می‌شوند؛
  // در غیر این صورت شمارش چرخه‌ها از رویدادها با هسته مشترک مشتق می‌شود.
  let completedCycles = 0;
  let flags: IntegrityFlag[] = [];
  if (row.status === "finalized") {
    const cycleRows = await listCycleRows(row.id);
    completedCycles = cycleRows.filter((c) => c.status !== "incomplete").length;
    flags = row.integrityFlagsJson ? (JSON.parse(row.integrityFlagsJson) as IntegrityFlag[]) : [];
  } else {
    const events = await listEventRows(row.id);
    const derived = deriveSession(events.map(rowToEventDto), parseElements(row), {
      method: row.method as "continuous" | "snapback" | "laps",
      tolerancePct: row.tolerancePct,
    });
    completedCycles = derived.completedCycles;
    flags = derived.flags;
  }
  return {
    id: row.id,
    method: row.method,
    methodLabelFa: TIMING_METHOD_LABELS_FA[row.method as keyof typeof TIMING_METHOD_LABELS_FA] ?? row.method,
    status: (isSessionStatus(row.status) ? row.status : "running"),
    statusLabelFa: SESSION_STATUS_LABELS_FA[(isSessionStatus(row.status) ? row.status : "running")],
    observer: row.observer,
    elementSource: row.elementSource as ElementSource,
    elementCount: parseElements(row).length,
    tolerancePct: row.tolerancePct,
    elementAdvanceMode: row.elementAdvanceMode as AdvanceMode,
    eventCount,
    cycleCount,
    completedCycles,
    flags,
    startedAtWall: row.startedAtWall?.toISOString() ?? null,
    endedAtWall: row.endedAtWall?.toISOString() ?? null,
    notes: row.notes,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─────────────────────── ایجاد جلسه ───────────────────────

export async function createSession(
  projectId: string,
  userId: string,
  raw: unknown,
  deviceMeta?: string | null,
): Promise<TimingSessionSummaryDto> {
  const input: CreateSessionInput = createSessionSchema.parse(raw);

  // یکتایی کلید عناصر در جلسه (ترتیب دقیق)
  const keys = new Set<string>();
  for (const el of input.elements) {
    if (keys.has(el.key)) {
      throw ApiError.badRequest(`کلید عنصر تکراری است: ${el.key}`, { field: "elements" });
    }
    keys.add(el.key);
  }

  const id = uuidv7();
  const row = await insertSessionRow({
    id,
    projectId,
    method: input.method,
    status: "running", // ایجاد جلسه = شروع ثبت (رویداد start از کلاینت می‌رسد)
    observer: input.observer,
    elementsJson: JSON.stringify(input.elements),
    elementAdvanceMode: input.elementAdvanceMode,
    tolerancePct: input.tolerancePct,
    elementSource: input.elementSource,
    diagramRefId: input.diagramRefId ?? null,
    diagramRefNote: input.diagramRefNote ?? null,
    notes: input.notes ?? null,
    deviceMetaJson: deviceMeta ?? null,
    createdBy: userId,
  });

  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.sessionCreated,
    entityType: "TimingSession",
    entityId: id,
    projectId,
    after: { method: input.method, observer: input.observer, elementCount: input.elements.length, elementSource: input.elementSource },
  });
  log.info("timing session created", { projectId, sessionId: id, method: input.method });

  return toSummaryDto(row);
}

// ─────────────────────── فهرست/جزئیات ───────────────────────

export async function listSessions(projectId: string): Promise<TimingSessionSummaryDto[]> {
  const rows = await listSessionRows(projectId);
  return Promise.all(rows.map(toSummaryDto));
}

export async function getSessionDetail(projectId: string, sessionId: string): Promise<TimingSessionDetailDto> {
  const row = await findSessionRow(projectId, sessionId);
  if (!row) throw ApiError.notFound("جلسه زمان‌سنجی یافت نشد.");

  const eventRows = await listEventRows(sessionId);
  const elements = parseElements(row);
  const events = eventRows.map(rowToEventDto);
  const derived = deriveSession(events, elements, {
    method: row.method as "continuous" | "snapback" | "laps",
    tolerancePct: row.tolerancePct,
  });

  const summary = await toSummaryDto(row);
  return {
    ...summary,
    elements,
    events,
    derived: {
      phase: derived.phase,
      currentCycleNo: derived.currentCycleNo,
      cycles: derived.cycles,
      completedCycles: derived.completedCycles,
      activeMs: derived.activeMs,
      pausedMs: derived.pausedMs,
      eventCount: derived.eventCount,
      flags: derived.flags,
      interruptions: derived.interruptions,
      startedAtWall: derived.startedAtWall,
      endedAtWall: derived.endedAtWall,
    },
    finalized: row.status === "finalized",
  };
}

// ─────────────────────── دریافت رویدادها (batch idempotent) ───────────────────────

export async function ingestEvents(
  projectId: string,
  sessionId: string,
  userId: string,
  raw: unknown,
): Promise<IngestResultDto> {
  const input: IngestEventsInput = ingestEventsSchema.parse(raw);
  const row = await findSessionRow(projectId, sessionId);
  if (!row) throw ApiError.notFound("جلسه زمان‌سنجی یافت نشد.");
  if (row.status === "finalized") {
    throw ApiError.conflict("جلسه نهایی شده است؛ ثبت رویداد جدید مجاز نیست (اصلاح از طریق ناظر مجاز و جلسه باز).");
  }

  const elements = parseElements(row);
  const elementKeys = new Set(elements.map((el) => el.key));
  const existingEvents = await listEventRows(sessionId);
  const knownIds = new Set(existingEvents.map((e) => e.clientEventId));
  // نگاشت رویدادهای موجود برای اعتبارسنجی هدف اصلاح (شامل همین batch)
  const batchIds = new Set(input.events.map((e) => e.clientEventId));

  let serverSeq = await maxEventSeq(sessionId);
  let ingested = 0;
  let duplicates = 0;
  const rejected: Array<{ clientEventId: string; reasonFa: string }> = [];
  const correctionTargets: string[] = [];

  for (const ev of input.events) {
    // تکراری با آنچه در سرور یا همین batch هست → skip بی‌اثر (idempotency)
    if (knownIds.has(ev.clientEventId)) {
      duplicates += 1;
      continue;
    }

    // اعتبارسنجی عنصر — ارجاع باید در اسنپ‌شات جلسه باشد (بدون کپی داده)
    if (ev.elementId !== undefined && !elementKeys.has(ev.elementId)) {
      rejected.push({ clientEventId: ev.clientEventId, reasonFa: `عنصر «${ev.elementId}» در جلسه تعریف نشده است.` });
      continue;
    }

    // اعتبارسنجی اصلاح — هدف باید موجود باشد (سرور یا همین batch)
    if (ev.type === "correction") {
      const targetMissing = !(ev.correctionOf && (knownIds.has(ev.correctionOf) || batchIds.has(ev.correctionOf)));
      const reasonMissing = !ev.correctionReason || ev.correctionReason.trim().length === 0;
      const valueInvalid = ev.correctedValueMs === undefined || ev.correctedValueMs < 0;
      if (targetMissing || reasonMissing || valueInvalid || !ev.correctionOf) {
        rejected.push({
          clientEventId: ev.clientEventId,
          reasonFa: "اصلاح نامعتبر است: هدف/دلیل/مقدار جدید الزامی است و هدف باید موجود باشد.",
        });
        continue;
      }
      correctionTargets.push(ev.correctionOf);
    }

    const result = await insertEventRow({
      id: uuidv7(),
      sessionId,
      clientEventId: ev.clientEventId,
      seq: ev.seq,
      type: ev.type,
      elementId: ev.elementId ?? null,
      cycleNo: ev.cycleNo,
      elapsedActiveMs: ev.elapsedActiveMs,
      splitMs: ev.splitMs ?? null,
      wallClock: new Date(ev.wallClock),
      note: ev.note ?? null,
      interruptionReason: ev.interruptionReason ?? null,
      correctionOf: ev.correctionOf ?? null,
      correctedValueMs: ev.correctedValueMs ?? null,
      correctionReason: ev.correctionReason ?? null,
      integrityJson: ev.integrity && ev.integrity.length > 0 ? JSON.stringify(ev.integrity) : null,
      origin: input.origin,
      receivedBy: userId,
    });

    if (result.outcome === "duplicate") {
      duplicates += 1;
      knownIds.add(ev.clientEventId);
      continue;
    }
    if (result.outcome === "seq-conflict") {
      // تخصیص seq جایگزین صریح — append-only حفظ می‌شود و ترتیب با seq مرتب می‌شود
      serverSeq += 1;
      await insertEventRow({
        id: uuidv7(),
        sessionId,
        clientEventId: ev.clientEventId,
        seq: serverSeq,
        type: ev.type,
        elementId: ev.elementId ?? null,
        cycleNo: ev.cycleNo,
        elapsedActiveMs: ev.elapsedActiveMs,
        splitMs: ev.splitMs ?? null,
        wallClock: new Date(ev.wallClock),
        note: ev.note ?? null,
        interruptionReason: ev.interruptionReason ?? null,
        correctionOf: ev.correctionOf ?? null,
        correctedValueMs: ev.correctedValueMs ?? null,
        correctionReason: ev.correctionReason ?? null,
        integrityJson: ev.integrity && ev.integrity.length > 0 ? JSON.stringify(ev.integrity) : null,
        origin: input.origin,
        receivedBy: userId,
      });
      ingested += 1;
      knownIds.add(ev.clientEventId);
      continue;
    }

    ingested += 1;
    knownIds.add(ev.clientEventId);
    if (ev.seq > serverSeq) serverSeq = ev.seq;
  }

  if (ingested === 0 && rejected.length > 0 && duplicates === 0) {
    throw ApiError.badRequest("هیچ رویداد معتبری برای ثبت نبود.", { rejected });
  }

  // به‌روزرسانی وضعیت جلسه از آخرین رویداد وضعیتی
  const updatedEvents = await listEventRows(sessionId);
  const events = updatedEvents.map(rowToEventDto);
  const derived = deriveSession(events, elements, {
    method: row.method as "continuous" | "snapback" | "laps",
    tolerancePct: row.tolerancePct,
  });
  const lastState = [...events].reverse().find((e) => STATE_EVENT_STATUS[e.type]);
  const newStatus = lastState ? STATE_EVENT_STATUS[lastState.type]! : "running";

  await updateSessionRow(sessionId, {
    status: newStatus,
    startedAtWall: derived.startedAtWall ? new Date(derived.startedAtWall) : row.startedAtWall,
    endedAtWall: derived.endedAtWall ? new Date(derived.endedAtWall) : row.endedAtWall,
    integrityFlagsJson: derived.flags.length > 0 ? JSON.stringify(derived.flags) : null,
  });

  // ممیزی اصلاح‌ها (اقدام کاربر) — رویدادهای معمول ممیزی نمی‌شوند (ADR-013)
  if (correctionTargets.length > 0) {
    await recordAudit({
      userId,
      action: AUDIT_ACTIONS.eventCorrected,
      entityType: "TimingSession",
      entityId: sessionId,
      projectId,
      after: { corrections: correctionTargets.length, targets: correctionTargets },
    });
  }

  log.info("timing events ingested", {
    projectId,
    sessionId,
    ingested,
    duplicates,
    rejected: rejected.length,
    status: newStatus,
  });

  return {
    ingested,
    duplicates,
    rejected,
    eventCount: events.length,
    sessionStatus: newStatus,
    flags: derived.flags,
  };
}

// ─────────────────────── یادداشت جلسه ───────────────────────

export async function patchSession(
  projectId: string,
  sessionId: string,
  userId: string,
  raw: unknown,
): Promise<TimingSessionSummaryDto> {
  const input = patchSessionSchema.parse(raw);
  const row = await findSessionRow(projectId, sessionId);
  if (!row) throw ApiError.notFound("جلسه زمان‌سنجی یافت نشد.");
  const updated = await updateSessionRow(sessionId, { notes: input.notes ?? null });
  log.info("timing session patched", { projectId, sessionId, userId });
  return toSummaryDto(updated);
}

// ─────────────────────── نهایی‌سازی ───────────────────────

export async function finalizeSession(projectId: string, sessionId: string, userId: string): Promise<FinalizeResultDto> {
  const row = await findSessionRow(projectId, sessionId);
  if (!row) throw ApiError.notFound("جلسه زمان‌سنجی یافت نشد.");
  if (row.status === "finalized") throw ApiError.conflict("جلسه قبلاً نهایی شده است.");

  const eventRows = await listEventRows(sessionId);
  const events = eventRows.map(rowToEventDto);
  const elements = parseElements(row);

  // جلسه باید با رویداد stop بسته شده باشد (قفل ورودی تحلیل فاز ۵)
  const last = events[events.length - 1];
  const lastState = [...events].reverse().find((e) => STATE_EVENT_STATUS[e.type]);
  const stopped = lastState?.type === "stop";
  if (!stopped) {
    throw ApiError.conflict(
      "نهایی‌سازی فقط پس از توقف جلسه ممکن است (آخرین رویداد وضعیتی باید stop باشد).",
      { lastEventType: last?.type ?? null },
    );
  }

  const derived = deriveSession(events, elements, {
    method: row.method as "continuous" | "snapback" | "laps",
    tolerancePct: row.tolerancePct,
  });

  // ذخیره چرخه‌های مشتق — ورودی پایدار تحلیل فاز ۵
  await replaceCycleRows(
    sessionId,
    derived.cycles.map((c) => ({
      seq: c.seq,
      status: c.status,
      startedAtEventId: c.startedAtEventId,
      endedAtEventId: c.endedAtEventId,
      startedElapsedMs: c.startedElapsedMs,
      endedElapsedMs: c.endedElapsedMs,
      cycleTimeMs: c.cycleTimeMs,
      elementsSumMs: c.elementsSumMs,
      deviationPct: c.deviationPct,
      elementsJson: JSON.stringify(c.elements),
      interruptionsJson: JSON.stringify(c.interruptions),
      flagsJson: c.flags.length > 0 ? JSON.stringify(c.flags) : null,
    })),
  );

  // رویداد finalize (تولید سرور — append-only)
  const serverSeq = await maxEventSeq(sessionId);
  await insertEventRow({
    id: uuidv7(),
    sessionId,
    clientEventId: `finalize-${uuidv7()}`,
    seq: serverSeq + 1,
    type: "finalize",
    elementId: null,
    cycleNo: derived.currentCycleNo,
    elapsedActiveMs: derived.activeMs,
    splitMs: null,
    wallClock: new Date(),
    note: null,
    interruptionReason: null,
    correctionOf: null,
    correctedValueMs: null,
    correctionReason: null,
    integrityJson: null,
    origin: "normal",
    receivedBy: userId,
  });

  await updateSessionRow(sessionId, { status: "finalized" });

  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.sessionFinalized,
    entityType: "TimingSession",
    entityId: sessionId,
    projectId,
    after: {
      cycles: derived.cycles.length,
      completed: derived.completedCycles,
      suspect: derived.cycles.filter((c) => c.status === "suspect").length,
      recovered: derived.cycles.filter((c) => c.status === "recovered").length,
    },
  });
  log.info("timing session finalized", { projectId, sessionId, cycles: derived.cycles.length });

  return {
    sessionId,
    status: "finalized",
    cycles: derived.cycles.length,
    completedCycles: derived.completedCycles,
    suspectCycles: derived.cycles.filter((c) => c.status === "suspect").length,
    recoveredCycles: derived.cycles.filter((c) => c.status === "recovered").length,
    incompleteCycles: derived.cycles.filter((c) => c.status === "incomplete").length,
    totalActiveMs: derived.activeMs,
  };
}

// ─────────────────────── چرخه‌ها ───────────────────────

export async function getSessionCycles(projectId: string, sessionId: string): Promise<{ finalized: boolean; cycles: unknown[] }> {
  const row = await findSessionRow(projectId, sessionId);
  if (!row) throw ApiError.notFound("جلسه زمان‌سنجی یافت نشد.");
  if (row.status === "finalized") {
    const cycleRows = await listCycleRows(sessionId);
    return {
      finalized: true,
      cycles: cycleRows.map((c) => ({
        seq: c.seq,
        status: c.status,
        startedAtEventId: c.startedAtEventId,
        endedAtEventId: c.endedAtEventId,
        startedElapsedMs: c.startedElapsedMs,
        endedElapsedMs: c.endedElapsedMs,
        cycleTimeMs: c.cycleTimeMs,
        elementsSumMs: c.elementsSumMs,
        deviationPct: c.deviationPct,
        elements: JSON.parse(c.elementsJson),
        interruptions: JSON.parse(c.interruptionsJson),
        flags: c.flagsJson ? JSON.parse(c.flagsJson) : [],
      })),
    };
  }
  const eventRows = await listEventRows(sessionId);
  const derived = deriveSession(eventRows.map(rowToEventDto), parseElements(row), {
    method: row.method as "continuous" | "snapback" | "laps",
    tolerancePct: row.tolerancePct,
  });
  return { finalized: false, cycles: derived.cycles };
}

// ─────────────────────── خروجی خام (بازیابی داده) ───────────────────────

export async function getRawExport(projectId: string, sessionId: string): Promise<{
  session: Record<string, unknown>;
  events: ChronoEvent[];
}> {
  const row = await findSessionRow(projectId, sessionId);
  if (!row) throw ApiError.notFound("جلسه زمان‌سنجی یافت نشد.");
  const eventRows = await listEventRows(sessionId);
  const events = eventRows.map(rowToEventDto);
  return {
    session: {
      id: row.id,
      projectId: row.projectId,
      method: row.method,
      status: row.status,
      observer: row.observer,
      elements: parseElements(row),
      elementAdvanceMode: row.elementAdvanceMode,
      tolerancePct: row.tolerancePct,
      elementSource: row.elementSource,
      integrityFlags: row.integrityFlagsJson ? JSON.parse(row.integrityFlagsJson) : [],
      notes: row.notes,
      startedAtWall: row.startedAtWall?.toISOString() ?? null,
      endedAtWall: row.endedAtWall?.toISOString() ?? null,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    },
    events,
  };
}

// ─────────────────────── ابزار نمایش (اشتراکی با UI) ───────────────────────

export function eventLabelFa(type: string): string {
  return CHRONO_EVENT_LABELS_FA[type as keyof typeof CHRONO_EVENT_LABELS_FA] ?? type;
}

export function flagLabelFa(flag: string): string {
  return INTEGRITY_FLAG_LABELS_FA[flag as keyof typeof INTEGRITY_FLAG_LABELS_FA] ?? flag;
}

export function elementSourceLabelFa(source: string): string {
  return ELEMENT_SOURCE_LABELS_FA[source as keyof typeof ELEMENT_SOURCE_LABELS_FA] ?? source;
}

// اسکیماهای عمومی برای routeها
export { createSessionSchema, ingestEventsSchema, patchSessionSchema };
