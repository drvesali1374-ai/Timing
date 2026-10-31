/**
 * موتور کرنومتر خالص — ماشین حالت event-sourced (فاز ۴ · ENGINE_CONTRACTS §۳ · ADR-004).
 *
 * ویژگی‌های کلیدی:
 *  - خالص: بدون DOM/Prisma — Clock و مولد شناسه تزریق می‌شوند (آزمون بدون مرورگر).
 *  - فاصله‌ها فقط از perfMs یکنواخت؛ wallClock فقط ممیزی (ADR-004).
 *  - رویدادها append-only با clientEventId idempotent — هرگز حذف/ویرایش نمی‌شوند.
 *  - اصلاح = رویداد correction با ارجاع (correctionOf) — بدون حذف.
 *  - بازیابی پس از reload: reconstruct() حالت را از رویدادها بازمی‌سازد؛
 *    ادامه زمان از دست‌رفته جعل نمی‌شود — recover() قطعه را «بازیابی‌شده» علامت می‌زند.
 *
 * نمایش زنده (hook مرورگر) مقدار را در هر فریم از elapsedActiveMs() می‌خواند —
 * هیچ شمارنده ثانیه‌ای انباشته‌شده‌ای وجود ندارد (C3-۴).
 */

import type { Clock } from "./clock";
import type { ChronoEvent, ChronoEventType, IntegrityFlag, SessionPhase, TimingElementRef, TimingMethod } from "./types";

export interface ChronoEngineOptions {
  clock: Clock;
  sessionId: string;
  method: TimingMethod;
  elements: TimingElementRef[];
  /** مولد شناسه رویداد (UUIDv7 در تولید؛ دنباله‌ای در آزمون) */
  idGen: () => string;
}

export interface ChronoEngineState {
  phase: SessionPhase;
  cycleNo: number;
  hasOpenCycle: boolean;
  /** اندیس عنصر جاری (اشاره‌گر پیش‌روی — راهنمای UI) */
  currentElementIndex: number;
  currentElementKey: string | null;
  nextElementKey: string | null;
  elapsedActiveMs: number;
  /** بازیابی در همین عمر صفحه انجام شده (پرچم clockRecovery صادر شده) */
  recovered: boolean;
  /** جلسه در حالت running بازسازی شده و تا فراخوانی recover() زمان زنده معتبر نیست */
  needsRecovery: boolean;
}

/** رویدادهای قابل اصلاح — فقط رویدادهای حامل قرائت زمانی. */
const CORRECTABLE_TYPES: readonly ChronoEventType[] = ["reading", "element", "lap", "cycleStart"];

export class ChronoEngine {
  private readonly clock: Clock;
  private readonly sessionId: string;
  readonly method: TimingMethod;
  readonly elements: TimingElementRef[];
  private readonly idGen: () => string;

  private _events: ChronoEvent[] = [];
  private _phase: SessionPhase = "idle";
  private _seq = 0;

  // زمان فعال انباشته قبل از سگمنت جاری + شروع سگمنت جاری (perf)
  private _activeBaseMs = 0;
  private _runStartPerfMs: number | null = null;

  private _cycleNo = 0;
  private _hasOpenCycle = false;
  private _boundaryElapsedMs = 0; // مرز آخرین cycleStart/reading/element/lap
  private _elementIndex = 0;

  private _recovered = false;
  private _needsRecovery = false;

  constructor(opts: ChronoEngineOptions) {
    this.clock = opts.clock;
    this.sessionId = opts.sessionId;
    this.method = opts.method;
    this.elements = [...opts.elements].sort((a, b) => a.order - b.order);
    this.idGen = opts.idGen;
  }

  // ─────────────────────── حالت زنده ───────────────────────

  /**
   * زمان فعال سپری‌شده (میلی‌ثانیه) — «قرائت کرنومتر» در همین لحظه.
   * سگمنت جاری از perf یکنواخت؛ پس از بازیابیِ اجرا نشده، مقدار آخرین رویداد
   * برگردانده می‌شود (جعل زمان گذشته ممنوع).
   */
  elapsedActiveMs(): number {
    if (this._phase === "running" && this._runStartPerfMs !== null && !this._needsRecovery) {
      return this._activeBaseMs + Math.max(0, this.clock.now().perfMs - this._runStartPerfMs);
    }
    return this._activeBaseMs;
  }

  state(): ChronoEngineState {
    const idx = this.elements.length > 0 ? Math.min(this._elementIndex, this.elements.length - 1) : 0;
    return {
      phase: this._phase,
      cycleNo: this._cycleNo,
      hasOpenCycle: this._hasOpenCycle,
      currentElementIndex: idx,
      currentElementKey: this.elements[idx]?.key ?? null,
      nextElementKey: this.elements[idx + 1]?.key ?? null,
      elapsedActiveMs: this.elapsedActiveMs(),
      recovered: this._recovered,
      needsRecovery: this._needsRecovery,
    };
  }

  events(): readonly ChronoEvent[] {
    return this._events;
  }

  integrity(): IntegrityFlag[] {
    const set = new Set<IntegrityFlag>();
    for (const e of this._events) for (const f of e.integrity ?? []) set.add(f);
    return [...set];
  }

  // ─────────────────────── عملیات کرنومتر ───────────────────────

  /** شروع جلسه — idle → running. */
  start(flags?: IntegrityFlag[]): ChronoEvent {
    if (this._phase !== "idle") throw new Error("جلسه قبلاً شروع شده است.");
    this._activeBaseMs = 0;
    this._runStartPerfMs = this.clock.now().perfMs;
    this._phase = "running";
    this._boundaryElapsedMs = 0;
    this._elementIndex = 0;
    return this.emit("start", { flags });
  }

  /** مرز شروع چرخه (r₀) — فقط در حالت ثبت. */
  cycleStart(flags?: IntegrityFlag[]): ChronoEvent {
    if (this._phase !== "running") throw new Error("شروع چرخه فقط در حالت ثبت ممکن است.");
    this._cycleNo += 1;
    this._hasOpenCycle = true;
    this._boundaryElapsedMs = this.elapsedActiveMs();
    this._elementIndex = 0;
    return this.emit("cycleStart", { flags });
  }

  /**
   * قرائت متوالی (روش پیوسته) — پایان عنصرِ elementId (یا عنصر اشاره‌گر).
   * مدت عنصر پس از ثبت از تفاضل قرائت‌ها تفکیک می‌شود (TS-003).
   */
  recordReading(elementId?: string, flags?: IntegrityFlag[]): ChronoEvent {
    if (this._phase !== "running") throw new Error("ثبت قرائت فقط در حالت ثبت ممکن است.");
    const key = this.resolveElementKey(elementId);
    const ev = this.emit("reading", { elementId: key ?? undefined, flags });
    this.advancePointer(key);
    return ev;
  }

  /**
   * ثبت مستقیم عنصر (روش بازگشت به صفر) — splitMs = مدت عنصر از مرز قبلی.
   */
  recordElement(elementId?: string, flags?: IntegrityFlag[]): ChronoEvent {
    if (this._phase !== "running") throw new Error("ثبت عنصر فقط در حالت ثبت ممکن است.");
    const key = this.resolveElementKey(elementId);
    const ev = this.emit("element", { elementId: key ?? undefined, flags });
    this.advancePointer(key);
    return ev;
  }

  /** نقطه میانی Lap/Split — مرز بازه بدون پیش‌روی عنصر. */
  lap(flags?: IntegrityFlag[]): ChronoEvent {
    if (this._phase !== "running") throw new Error("ثبت حلقه فقط در حالت ثبت ممکن است.");
    return this.emit("lap", { flags });
  }

  /** مکث با علت وقفه اختیاری — running → paused. */
  pause(reason?: string, flags?: IntegrityFlag[]): ChronoEvent {
    if (this._phase !== "running") throw new Error("مکث فقط در حالت ثبت ممکن است.");
    this._activeBaseMs = this.elapsedActiveMs();
    this._runStartPerfMs = null;
    this._phase = "paused";
    return this.emit("pause", { interruptionReason: reason, flags });
  }

  /** ادامه پس از مکث — paused → running. */
  resume(flags?: IntegrityFlag[]): ChronoEvent {
    if (this._phase !== "paused") throw new Error("ادامه فقط در حالت مکث ممکن است.");
    this._runStartPerfMs = this.clock.now().perfMs;
    this._phase = "running";
    return this.emit("resume", { flags });
  }

  /** پایان جلسه — running|paused → stopped. */
  stop(note?: string, flags?: IntegrityFlag[]): ChronoEvent {
    if (this._phase !== "running" && this._phase !== "paused") throw new Error("جلسه فعال نیست.");
    if (this._phase === "running") {
      this._activeBaseMs = this.elapsedActiveMs();
      this._runStartPerfMs = null;
    }
    this._phase = "stopped";
    return this.emit("stop", { note, flags });
  }

  /** یادداشت سریع — در هر حالتی (بدون تغییر زمان). */
  note(text: string, flags?: IntegrityFlag[]): ChronoEvent {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("متن یادداشت خالی است.");
    return this.emit("note", { note: trimmed, flags });
  }

  /**
   * اصلاح رویداد قبلی — append-only: رویداد correction با ارجاع، هرگز حذف.
   * معنای مقدار جدید: برای reading/lap/cycleStart → elapsedActiveMs جدید؛
   * برای element → مدت مستقیم (splitMs) جدید. دلیل اصلاح الزامی است.
   */
  correct(targetEventId: string, newValueMs: number, reason: string): ChronoEvent {
    const trimmedReason = reason.trim();
    if (!trimmedReason) throw new Error("دلیل اصلاح الزامی است.");
    const target = this._events.find((e) => e.clientEventId === targetEventId);
    if (!target) throw new Error("رویداد هدف اصلاح یافت نشد.");
    if (!CORRECTABLE_TYPES.includes(target.type)) {
      throw new Error("فقط رویداد‌های قرائت/عنصر/حلقه/شروع چرخه قابل اصلاح‌اند.");
    }
    if (!Number.isFinite(newValueMs) || newValueMs < 0) throw new Error("مقدار اصلاحی نامعتبر است.");
    return this.emit("correction", {
      correctionOf: targetEventId,
      correctedValueMs: newValueMs,
      correctionReason: trimmedReason,
    });
  }

  /**
   * بازیابی پس از reload/بازگشت — صداقت دقت (ADR-004):
   * اگر جلسه در حالت ثبت بازسازی شده باشد، زمان گذشته در غیاب صفحه قابل اثبات نیست؛
   * جلسه به مکث «بازیابی‌شده» می‌رود و پرچم clockRecovery روی رویداد ثبت می‌شود.
   * ادامه فقط با تصمیم صریح کاربر (resume).
   */
  recover(): ChronoEvent | null {
    if (!this._needsRecovery || this._phase !== "running") {
      this._needsRecovery = false;
      return null;
    }
    this._runStartPerfMs = null;
    this._phase = "paused";
    this._needsRecovery = false;
    this._recovered = true;
    return this.emit("pause", {
      interruptionReason: "بازگشت پس از بارگذاری مجدد صفحه",
      note: "جلسه بازیابی شد؛ زمان گذشته در غیاب صفحه قابل اندازه‌گیری قطعی نیست — نیازمند بررسی.",
      flags: ["clockRecovery"],
    });
  }

  // ─────────────────────── بازسازی از رویدادها (event-sourced) ───────────────────────

  /**
   * بازسازی موتور از دفتر رویداد (پس از reload / بارگذاری از سرور).
   * هیچ زمانی جعل نمی‌شود؛ جلسه running نیازمند recover() است.
   */
  static reconstruct(events: ChronoEvent[], opts: Omit<ChronoEngineOptions, "sessionId"> & { sessionId: string }): ChronoEngine {
    const engine = new ChronoEngine(opts);
    engine.loadEvents(events);
    return engine;
  }

  loadEvents(events: ChronoEvent[]): void {
    // مرتب‌سازی پایدار بر اساس seq؛ رد موارد ناهم‌ترتیب/تکراری شناسه
    const sorted = [...events].sort((a, b) => a.seq - b.seq);
    const seen = new Set<string>();
    this._events = [];
    this._phase = "idle";
    this._seq = 0;
    this._activeBaseMs = 0;
    this._runStartPerfMs = null;
    this._cycleNo = 0;
    this._hasOpenCycle = false;
    this._boundaryElapsedMs = 0;
    this._elementIndex = 0;

    for (const ev of sorted) {
      if (seen.has(ev.clientEventId)) continue; // idempotent journal
      if (ev.seq <= this._seq) continue; // ترتیب اکیداً صعودنی — رد صامت دفاعی
      seen.add(ev.clientEventId);
      this._seq = ev.seq;
      this._events.push(ev);

      // بازپخش حالت
      const elapsed = Math.max(0, ev.elapsedActiveMs);
      switch (ev.type) {
        case "start":
          this._phase = "running";
          this._activeBaseMs = 0;
          this._boundaryElapsedMs = 0;
          this._elementIndex = 0;
          break;
        case "cycleStart":
          this._cycleNo += 1;
          this._hasOpenCycle = true;
          this._boundaryElapsedMs = elapsed;
          this._elementIndex = 0;
          break;
        case "reading":
        case "element":
        case "lap":
          this._boundaryElapsedMs = elapsed;
          if (ev.elementId) {
            const idx = this.elements.findIndex((el) => el.key === ev.elementId);
            if (idx >= 0) this._elementIndex = Math.min(idx + 1, Math.max(0, this.elements.length - 1));
          }
          break;
        case "pause":
          this._activeBaseMs = elapsed;
          this._phase = "paused";
          break;
        case "resume":
          this._activeBaseMs = elapsed;
          this._phase = "running";
          break;
        case "stop":
          this._activeBaseMs = elapsed;
          this._phase = "stopped";
          break;
        default:
          break; // note/correction/finalize — بدون تغییر حالت
      }
    }
    // جلسه running پس از reload: مبدأ perf از بین رفته — تا recover() زمان زنده معتبر نیست
    this._needsRecovery = this._phase === "running";
    if (this._needsRecovery) this._activeBaseMs = this.lastEventElapsed();
  }

  // ─────────────────────── داخلی ───────────────────────

  private lastEventElapsed(): number {
    for (let i = this._events.length - 1; i >= 0; i -= 1) {
      const e = this._events[i];
      if (["start", "cycleStart", "reading", "element", "lap", "pause", "resume", "stop"].includes(e.type)) {
        return Math.max(0, e.elapsedActiveMs);
      }
    }
    return 0;
  }

  private resolveElementKey(explicit?: string): string | null {
    if (explicit) {
      const found = this.elements.find((el) => el.key === explicit);
      return found ? found.key : null;
    }
    return this.elements[this._elementIndex]?.key ?? null;
  }

  private advancePointer(usedKey: string | null): void {
    if (!usedKey) return;
    const idx = this.elements.findIndex((el) => el.key === usedKey);
    if (idx >= 0) this._elementIndex = Math.min(idx + 1, Math.max(0, this.elements.length - 1));
  }

  private emit(
    type: ChronoEventType,
    extra: {
      elementId?: string;
      note?: string;
      interruptionReason?: string;
      correctionOf?: string;
      correctedValueMs?: number;
      correctionReason?: string;
      flags?: IntegrityFlag[];
    } = {},
  ): ChronoEvent {
    const now = this.clock.now();
    const elapsed = this.elapsedActiveMs();
    const splitBoundary = ["cycleStart", "reading", "element", "lap"].includes(type);
    const ev: ChronoEvent = {
      clientEventId: this.idGen(),
      sessionId: this.sessionId,
      seq: this._seq + 1,
      type,
      cycleNo: this._cycleNo,
      elapsedActiveMs: Math.round(elapsed * 1000) / 1000, // دقت ثبت: میکروثانیه — سرریز اعشار مهار
      wallClock: now.wall.toISOString(),
      ...(extra.elementId !== undefined ? { elementId: extra.elementId } : {}),
      ...(splitBoundary ? { splitMs: Math.round((elapsed - this._boundaryElapsedMs) * 1000) / 1000 } : {}),
      ...(extra.note !== undefined ? { note: extra.note } : {}),
      ...(extra.interruptionReason !== undefined && extra.interruptionReason !== null && extra.interruptionReason !== ""
        ? { interruptionReason: extra.interruptionReason }
        : {}),
      ...(extra.correctionOf !== undefined ? { correctionOf: extra.correctionOf } : {}),
      ...(extra.correctedValueMs !== undefined ? { correctedValueMs: extra.correctedValueMs } : {}),
      ...(extra.correctionReason !== undefined ? { correctionReason: extra.correctionReason } : {}),
      ...(extra.flags && extra.flags.length > 0 ? { integrity: extra.flags } : {}),
    };
    this._seq += 1;
    this._events.push(ev);
    if (splitBoundary) this._boundaryElapsedMs = elapsed;
    return ev;
  }
}
