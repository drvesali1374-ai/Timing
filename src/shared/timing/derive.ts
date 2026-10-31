/**
 * مشتق‌سازی خالص جلسه زمان‌سنجی از دفتر رویداد (فاز ۴).
 *
 *  - TS-003 (تفکیک قرائت پیوسته): dᵢ = rᵢ − rᵢ₋₁ با r₀ = شروع چرخه.
 *  - TS-004 (زمان چرخه مشاهده‌شده): از مرزهای چرخه.
 *  - TS-005 (تلورانس جمع): |Σdᵢ − C| ÷ C ≤ τ — فقط روش پیوسته (PROFILES §۴٫۱).
 *  - اصلاح‌ها (correction) اعمال می‌شوند — رویداد هدف هرگز حذف نمی‌شود؛
 *    آخرین اصلاح برنده است و ردپای کامل در دفتر رویداد می‌ماند.
 *
 * این ماژول مرجع حقیقت مشترک کلاینت/سرور است: هر دو از همان تابع می‌خوانند
 * تا نسخه سرور و نمایش کلاینت هیچ‌گاه واگرا نشوند (قطعیت مشتق).
 */

import type {
  ChronoEvent,
  DerivedCycle,
  DerivedSessionSummary,
  ElementObservation,
  IntegrityFlag,
  InterruptionRecord,
  SessionPhase,
  TimingElementRef,
  TimingMethod,
} from "./types";

export interface DeriveOptions {
  method: TimingMethod;
  /** تلورانس کنترل جمع چرخه (درصد) — پیش‌فرض پروفایل ۵٪ (فقط continuous) */
  tolerancePct?: number;
}

interface CorrectionsMap {
  /** targetClientEventId → آخرین اصلاح */
  byTarget: Map<string, CorrectionEvent>;
}

/** رویداد اصلاح — نوع کمکی برای دسترسی امن به فیلدها. */
interface CorrectionEvent extends ChronoEvent {
  type: "correction";
  correctionOf: string;
  correctedValueMs?: number;
  correctionReason?: string;
}

const TIMING_STATE_TYPES = new Set(["start", "cycleStart", "reading", "element", "lap", "pause", "resume", "stop"]);

/** اعمال اصلاح‌ها: مقدار مؤثر elapsedActiveMs یک رویداد (آخرین اصلاح برنده). */
function effectiveElapsed(ev: ChronoEvent, corr: CorrectionsMap): number {
  const c = corr.byTarget.get(ev.clientEventId);
  if (c && c.correctedValueMs !== undefined && (ev.type === "reading" || ev.type === "lap" || ev.type === "cycleStart")) {
    return c.correctedValueMs;
  }
  return ev.elapsedActiveMs;
}

/** مدت مؤثر عنصر snapback (splitMs) با اعمال اصلاح مستقیم مدت. */
function effectiveSplitMs(ev: ChronoEvent, corr: CorrectionsMap): number {
  const c = corr.byTarget.get(ev.clientEventId);
  if (c && c.correctedValueMs !== undefined && ev.type === "element") return c.correctedValueMs;
  return ev.splitMs ?? ev.elapsedActiveMs;
}

function correctedTargets(corr: CorrectionsMap): Set<string> {
  return new Set(corr.byTarget.keys());
}

function parseWallMs(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function unionFlags(...sources: Array<IntegrityFlag[] | undefined>): IntegrityFlag[] {
  const set = new Set<IntegrityFlag>();
  for (const s of sources) for (const f of s ?? []) set.add(f);
  return [...set];
}

/**
 * مشتق‌سازی کامل جلسه — قطعی: (رویدادها + گزینه‌ها) یکسان → خروجی یکسان.
 */
export function deriveSession(events: ChronoEvent[], elements: TimingElementRef[], opts: DeriveOptions): DerivedSessionSummary {
  const tolerancePct = opts.tolerancePct ?? 5;
  const elementName = (key: string | undefined): string => {
    if (!key) return "بدون عنصر";
    return elements.find((el) => el.key === key)?.name ?? key;
  };

  // ۱) مرتب‌سازی پایدار بر seq + حذف تکراری شناسه (idempotency در مشتق)
  const sorted = dedupeAndSort(events);

  // ۲) نگاشت اصلاح‌ها (آخرین برنده)
  const corr: CorrectionsMap = { byTarget: new Map<string, CorrectionEvent>() };
  for (const ev of sorted) {
    if (ev.type === "correction" && ev.correctionOf) {
      corr.byTarget.set(ev.correctionOf, ev as CorrectionEvent);
    }
  }
  const corrected = correctedTargets(corr);

  // ۳) پیمایش رویدادها
  let phase: SessionPhase = "idle";
  let cycleCounter = 0;
  const cycles: DerivedCycle[] = [];
  let open: {
    seq: number;
    startedAtEventId: string;
    startedElapsedMs: number;
    elements: ElementObservation[];
    interruptions: InterruptionRecord[];
    flags: IntegrityFlag[];
    prevBoundaryElapsedMs: number;
    prevBoundaryEventId: string | null;
    openPause: InterruptionRecord | null;
    closed: boolean;
  } | null = null;

  let activeMs = 0;
  const allInterruptions: InterruptionRecord[] = [];
  const sessionFlags = new Set<IntegrityFlag>();
  let startedAtWall: string | null = null;
  let endedAtWall: string | null = null;
  let pausedKnownMs = 0;
  let pausedUnknown = false;

  const closeCycle = (endEvent: ChronoEvent | null) => {
    if (!open) return;
    const endedElapsed = endEvent ? effectiveElapsed(endEvent, corr) : null;
    const cycleTimeMs = endedElapsed !== null ? endedElapsed - open.startedElapsedMs : null;
    const elementsSumMs = open.elements.reduce((acc, e) => acc + e.durationMs, 0);
    let status: DerivedCycle["status"] = "valid";
    const flags = open.flags;

    // تلورانس TS-005 — فقط روش پیوسته و با C موجود
    let deviationPct: number | null = null;
    if (opts.method === "continuous" && cycleTimeMs !== null && cycleTimeMs > 0) {
      deviationPct = (Math.abs(elementsSumMs - cycleTimeMs) / cycleTimeMs) * 100;
      if (deviationPct > tolerancePct) status = "suspect";
    }
    if (flags.includes("clockRecovery")) status = "recovered";
    if (endEvent === null) status = "incomplete"; // چرخه هنوز باز است

    // چرخه ناتمام در پایان جلسه (توقف وسط چرخه)
    if (endEvent?.type === "stop" && open.elements.length < elements.length) status = "incomplete";

    cycles.push({
      seq: open.seq,
      status,
      startedAtEventId: open.startedAtEventId,
      endedAtEventId: endEvent?.clientEventId ?? null,
      startedElapsedMs: open.startedElapsedMs,
      endedElapsedMs: endedElapsed,
      cycleTimeMs,
      elements: open.elements,
      elementsSumMs,
      deviationPct,
      interruptions: open.interruptions,
      flags,
    });
    open = null;
  };

  for (const ev of sorted) {
    for (const f of ev.integrity ?? []) sessionFlags.add(f);
    if (ev.type === "start") startedAtWall = startedAtWall ?? ev.wallClock;

    switch (ev.type) {
      case "start":
        phase = "running";
        activeMs = 0;
        break;

      case "cycleStart": {
        closeCycle(ev);
        cycleCounter += 1;
        open = {
          seq: cycleCounter,
          startedAtEventId: ev.clientEventId,
          startedElapsedMs: effectiveElapsed(ev, corr),
          elements: [],
          interruptions: [],
          flags: [...(ev.integrity ?? [])],
          prevBoundaryElapsedMs: effectiveElapsed(ev, corr),
          prevBoundaryEventId: ev.clientEventId,
          openPause: null,
          closed: false,
        };
        break;
      }

      case "reading":
      case "lap": {
        const elapsed = effectiveElapsed(ev, corr);
        if (open) {
          // TS-003: تفاضل قرائت متوالی
          const durationMs = Math.max(0, elapsed - open.prevBoundaryElapsedMs);
          open.elements.push({
            elementKey: ev.elementId ?? "",
            elementName: elementName(ev.elementId),
            durationMs,
            readingEventId: ev.clientEventId,
            readingMode: opts.method,
            flags: [...(ev.integrity ?? [])],
            corrected: corrected.has(ev.clientEventId),
          });
          open.flags = unionFlags(open.flags, ev.integrity);
          open.prevBoundaryElapsedMs = elapsed;
          open.prevBoundaryEventId = ev.clientEventId;
        } // قرائت پیش از چرخه اول — بدون چرخه شمرده نمی‌شود
        if (phase === "running") activeMs = Math.max(activeMs, elapsed);
        break;
      }

      case "element": {
        // snapback: مدت مستقیم از splitMs (با اعمال اصلاح)
        const durationMs = Math.max(0, effectiveSplitMs(ev, corr));
        if (open) {
          open.elements.push({
            elementKey: ev.elementId ?? "",
            elementName: elementName(ev.elementId),
            durationMs,
            readingEventId: ev.clientEventId,
            readingMode: "snapback",
            flags: [...(ev.integrity ?? [])],
            corrected: corrected.has(ev.clientEventId),
          });
          open.flags = unionFlags(open.flags, ev.integrity);
        } else if (phase === "running") {
          // ثبت عنصر پیش از چرخه اول — نادیده در شمارش چرخه‌ها
          activeMs = Math.max(activeMs, ev.elapsedActiveMs);
        }
        break;
      }

      case "pause": {
        const rec: InterruptionRecord = {
          pauseEventId: ev.clientEventId,
          resumeEventId: null,
          reason: ev.interruptionReason ?? null,
          note: ev.note ?? null,
          durationMs: null,
          durationUnknown: (ev.integrity ?? []).includes("clockRecovery"),
          flags: [...(ev.integrity ?? [])],
          cycleNo: open?.seq ?? 0,
        };
        if (open) {
          open.interruptions.push(rec);
          open.openPause = rec;
          open.flags = unionFlags(open.flags, ev.integrity);
        }
        allInterruptions.push(rec);
        phase = "paused";
        break;
      }

      case "resume": {
        const rec = [...allInterruptions].reverse().find((r) => r.resumeEventId === null);
        if (rec) {
          rec.resumeEventId = ev.clientEventId;
          rec.flags = unionFlags(rec.flags, ev.integrity);
          const pauseWall = parseWallMs(
            sorted.find((e) => e.clientEventId === rec.pauseEventId)?.wallClock ?? "",
          );
          const resumeWall = parseWallMs(ev.wallClock);
          if (pauseWall !== null && resumeWall !== null && !rec.durationUnknown) {
            rec.durationMs = Math.max(0, resumeWall - pauseWall);
            pausedKnownMs += rec.durationMs;
          } else {
            rec.durationUnknown = true;
            pausedUnknown = true;
          }
          if (open && open.openPause?.pauseEventId === rec.pauseEventId) open.openPause = null;
        }
        phase = "running";
        break;
      }

      case "stop": {
        closeCycle(ev);
        phase = "stopped";
        endedAtWall = ev.wallClock;
        activeMs = Math.max(activeMs, effectiveElapsed(ev, corr));
        break;
      }

      case "note":
      case "correction":
      case "finalize":
      default:
        break;
    }
  }

  // چرخه بازِ باقی‌مانده (جلسه هنوز فعال) — incomplete
  closeCycle(null);

  // وقفه‌های باز (مکث بدون ادامه): مدت نامشخص — ادعای دقت نمی‌شود
  for (const it of allInterruptions) {
    if (it.resumeEventId === null) {
      it.durationUnknown = true;
      pausedUnknown = true;
    }
  }

  const completedCycles = cycles.filter((c) => c.status !== "incomplete").length;

  return {
    phase,
    currentCycleNo: cycleCounter,
    cycles,
    completedCycles,
    activeMs,
    pausedMs: pausedUnknown ? null : pausedKnownMs,
    eventCount: sorted.length,
    flags: [...sessionFlags],
    interruptions: allInterruptions,
    startedAtWall,
    endedAtWall,
  };
}

/** مرتب‌سازی پایدار + حذف تکراری شناسه — ورودی هر مجموعه رویداد (سرور/کلاینت). */
export function dedupeAndSort(events: ChronoEvent[]): ChronoEvent[] {
  const seen = new Set<string>();
  const out: ChronoEvent[] = [];
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  for (const ev of sorted) {
    if (seen.has(ev.clientEventId)) continue;
    seen.add(ev.clientEventId);
    out.push(ev);
  }
  return out;
}

/** فهرست رویدادهای قابل اصلاح (برای UI اصلاح) — فقط رویدادهای حامل قرائت. */
export function correctableEvents(events: ChronoEvent[]): ChronoEvent[] {
  return dedupeAndSort(events).filter((e) => TIMING_STATE_TYPES.has(e.type) && e.type !== "start" && e.type !== "pause" && e.type !== "resume" && e.type !== "stop");
}
