/**
 * هسته خالص زمان‌سنجی — انواع مشترک (فاز ۴ · ENGINE_CONTRACTS §۳ · ADR-004).
 *
 * این ماژول خالص است: بدون DOM، بدون Prisma، بدون node:crypto —
 * هم در آزمون واحد (bun test) و هم در مرورگر و هم در سرور اجرا می‌شود.
 *
 * مرجع روش‌شناختی:
 *  - زمان‌سنجی پیوسته/بازگشت به صفر: روش متعارف مطالعه کار (ILO/REFA — استناد مفهومی، PROFILES.md §۴).
 *  - تفکیک TS-003 (تفاضل قرائت‌ها)، TS-004 (زمان چرخه)، TS-005 (تلورانس جمع) — FORMULA_CATALOG.md.
 *  - performance.now() یکنواخت در عمر سند؛ مبدأ بین reload عوض می‌شود — MDN «High precision timing»
 *    (بازیابی ۲۰۲۶-۱۰-۳۱؛ CC-BY-SA) — ADR-004.
 *  - UUIDv7 — RFC 9562 (مه ۲۰۲۴).
 */

// ─────────────────────── روش زمان‌سنجی (از پروفایل پروژه) ───────────────────────

export type TimingMethod = "continuous" | "snapback" | "laps";

export const TIMING_METHODS: readonly TimingMethod[] = ["continuous", "snapback", "laps"];

export function isTimingMethod(v: unknown): v is TimingMethod {
  return typeof v === "string" && (TIMING_METHODS as readonly string[]).includes(v);
}

export const TIMING_METHOD_LABELS_FA: Record<TimingMethod, string> = {
  continuous: "پیوسته",
  snapback: "بازگشت به صفر (عنصری)",
  laps: "حلقه‌ای (Lap/Split)",
};

export const TIMING_METHOD_NOTES_FA: Record<TimingMethod, string> = {
  continuous: "کرنومتر در طول چرخه متوقف نمی‌شود؛ قرائت در مرز هر عنصر ثبت و مدت‌ها پس از ثبت تفکیک می‌شود (TS-003).",
  snapback: "پس از هر عنصر، شمارنده به صفر بازمی‌گردد و مدت هر عنصر مستقیم ثبت می‌شود؛ کنترل تلورانس جمع (TS-005) اعمال نمی‌شود.",
  laps: "نقاط میانی (Lap) در طول چرخه ثبت می‌شوند؛ زمان هر بازه از تفاضل نقاط محاسبه می‌شود.",
};

// ─────────────────────── رویدادهای کرنومتر (append-only) ───────────────────────

/**
 * انواع رویداد — مجموعه بسته (DATA_DICTIONARY §۲٫۱۲ + قید lap از ENGINE_CONTRACTS §۳).
 * رویدادها هرگز فیزیکی حذف/ویرایش نمی‌شوند؛ اصلاح = رویداد correction با ارجاع.
 */
export type ChronoEventType =
  | "start" // شروع جلسه
  | "cycleStart" // مرز شروع چرخه (r₀ در روش پیوسته)
  | "reading" // قرائت متوالی (پیوسته) — پایان عنصر جاری
  | "element" // ثبت مستقیم عنصر (بازگشت به صفر)
  | "lap" // نقطه میانی (Lap/Split)
  | "pause" // مکث (با علت وقفه اختیاری)
  | "resume" // ادامه پس از مکث
  | "stop" // پایان جلسه
  | "note" // یادداشت سریع
  | "correction" // اصلاح رویداد قبلی (correctionOf + مقدار جدید + دلیل)
  | "finalize"; // نهایی‌سازی (سمت سرور تولید می‌شود — قفل برای تحلیل فاز ۵)

export const CHRONO_EVENT_TYPES: readonly ChronoEventType[] = [
  "start",
  "cycleStart",
  "reading",
  "element",
  "lap",
  "pause",
  "resume",
  "stop",
  "note",
  "correction",
  "finalize",
];

export function isChronoEventType(v: unknown): v is ChronoEventType {
  return typeof v === "string" && (CHRONO_EVENT_TYPES as readonly string[]).includes(v);
}

export const CHRONO_EVENT_LABELS_FA: Record<ChronoEventType, string> = {
  start: "شروع",
  cycleStart: "شروع چرخه",
  reading: "قرائت",
  element: "عنصر",
  lap: "حلقه",
  pause: "مکث",
  resume: "ادامه",
  stop: "پایان",
  note: "یادداشت",
  correction: "اصلاح",
  finalize: "نهایی‌سازی",
};

// ─────────────────────── پرچم‌های یکپارچگی (ADR-004) ───────────────────────

/**
 * پرچم‌های صداقت دقت — «قطعیت زمان بیش از واقع نشان داده نمی‌شود».
 *  - visibilityLoss: صفحه/تب هنگام ثبت فعال مخفی شده بود.
 *  - sleepSuspected: انحراف معنادار ساعت دیواری نسبت به زمان یکنواخت (خواب دستگاه مشکوک).
 *  - clockRecovery: جلسه پس از reload/بازگشت بازیابی شده؛ قطعات مرزی قابل اتکا نیستند.
 */
export type IntegrityFlag = "visibilityLoss" | "sleepSuspected" | "clockRecovery";

export const INTEGRITY_FLAGS: readonly IntegrityFlag[] = ["visibilityLoss", "sleepSuspected", "clockRecovery"];

export const INTEGRITY_FLAG_LABELS_FA: Record<IntegrityFlag, string> = {
  visibilityLoss: "مخفی‌شدن صفحه هنگام ثبت",
  sleepSuspected: "شک به خواب دستگاه",
  clockRecovery: "بازیابی پس از بارگذاری مجدد",
};

export const INTEGRITY_FLAG_HINTS_FA: Record<IntegrityFlag, string> = {
  visibilityLoss: "صفحه/تب در حالت ثبت مخفی شده بود؛ رویدادهای این بازه «نیازمند بررسی» تلقی می‌شوند.",
  sleepSuspected:
    "اختلاف معنادار ساعت تقویمی با زمان یکنواخت دیده شد؛ احتمال خواب/کند شدن دستگاه — دقت این بازه تضمین نمی‌شود.",
  clockRecovery:
    "جلسه پس از بارگذاری مجدد صفحه بازیابی شده است؛ زمان گذشته در غیاب صفحه قابل اثبات نیست و این قطعه علامت خورده است.",
};

// ─────────────────────── رویداد کرنومتر ───────────────────────

/** عنصر قابل زمان‌سنجی — اسنپ‌شات پایدار در جلسه (ارجاع + نام لحظه ثبت). */
export interface TimingElementRef {
  /** کلید عنصر در جلسه (activityStableKey یا کلید دستی مثل m1) */
  key: string;
  /** نام نمایشی لحظه ایجاد جلسه (پایداری تاریخی رکورد) */
  name: string;
  /** ارجاع اختیاری به فعالیت پروژه (B5) — بدون کپی داده */
  activityStableKey?: string;
  order: number;
}

export interface ChronoEvent {
  /** شناسه یکتا idempotent (UUIDv7 — RFC 9562) — تولید سمت کاربر */
  clientEventId: string;
  sessionId: string;
  /** ترتیب دقیق درون جلسه — اکیداً صعودی، یکتا در جلسه */
  seq: number;
  type: ChronoEventType;

  /** عنصر مرتبط (پایان عنصر در reading · عنصر اندازه‌گیری‌شده در element) */
  elementId?: string;

  /** شماره چرخه جاری هنگام رویداد (۱-مبنا؛ ۰ = پیش از چرخه اول) */
  cycleNo: number;

  /**
   * زمان سپری‌شده فعال یکنواخت (میلی‌ثانیه) — «قرائت کرنومتر».
   * فقط فاصله‌های درون-جلسه از performance.now() محاسبه می‌شوند (ADR-004).
   * مکث‌ها جزو زمان فعال نیستند.
   */
  elapsedActiveMs: number;

  /**
   * بازه از مرز قبلی (cycleStart/element/lap) — «قرائت بازگشت به صفر».
   * در روش snapback همان مدت مستقیم عنصر است؛ در پیوسته/حلقه‌ای برای نمایش split.
   */
  splitMs?: number;

  /** زمان دیواری/تقویمی — صرفاً ممیزی و گزارش انسانی؛ هرگز مبنای فاصله نیست. */
  wallClock: string; // ISO-8601

  note?: string;

  /** علت وقفه (رویدادهای pause) */
  interruptionReason?: string;

  // ── فقط رویداد correction ──
  /** رویداد هدف اصلاح (clientEventId) — اصلاح بدون حذف */
  correctionOf?: string;
  /** مقدار اصلاحی elapsedActiveMs هدف */
  correctedValueMs?: number;
  /** دلیل اصلاح — الزامی در correction */
  correctionReason?: string;

  /** پرچم‌های یکپارچگی لحظه ثبت همین رویداد */
  integrity?: IntegrityFlag[];
}

// ─────────────────────── وضعیت جلسه (مشتق از رویدادها) ───────────────────────

export type SessionPhase = "idle" | "running" | "paused" | "stopped";

export const SESSION_PHASE_LABELS_FA: Record<SessionPhase, string> = {
  idle: "آماده",
  running: "در حال ثبت",
  paused: "مکث",
  stopped: "پایان‌یافته",
};

/** وضعیت ذخیره جلسه (سمت کلاینت — قابل مشاهده برای کاربر) */
export type SessionSaveState = "local" | "synced" | "queued" | "conflict" | "recovered";

export const SESSION_SAVE_STATE_LABELS_FA: Record<SessionSaveState, string> = {
  local: "ذخیره محلی",
  synced: "همگام با سرور",
  queued: "در صف محلی (آفلاین)",
  conflict: "تعارض همگام‌سازی — نیازمند تصمیم",
  recovered: "بازیابی‌شده — نیازمند بررسی",
};

// ─────────────────────── خروجی مشتق (چرخه/عنصر/وقفه) ───────────────────────

/** مشاهده عنصر درون یک چرخه (ورودی تحلیل فاز ۵). */
export interface ElementObservation {
  elementKey: string;
  elementName: string;
  /** مدت فعال عنصر (ms) — TS-003: تفاضل قرائت‌ها / snapback: مقدار مستقیم */
  durationMs: number;
  /** رویداد قرائت مبنای این مشاهده (ردیابی) */
  readingEventId: string;
  /** روش ثبت این مشاهده */
  readingMode: TimingMethod;
  flags: IntegrityFlag[];
  /** اصلاح شده؟ (رویداد correction روی قرائت مبناعمل شده) */
  corrected: boolean;
}

/** وقفه ثبت‌شده (pause→resume). */
export interface InterruptionRecord {
  pauseEventId: string;
  resumeEventId: string | null;
  reason: string | null;
  note: string | null;
  /** مدت وقفه از ساعت دیواری (ms) — null یعنی «نامشخص» (بازگشت هنوز نیامده/قطعه بازیابی) */
  durationMs: number | null;
  /** مدت نامشخص است (قطعه بازیابی‌شده — ادعای دقت نمی‌شود) */
  durationUnknown: boolean;
  flags: IntegrityFlag[];
  /** چرخه‌ای که وقفه در آن رخ داده */
  cycleNo: number;
}

export type CycleStatus = "valid" | "suspect" | "incomplete" | "recovered";

export const CYCLE_STATUS_LABELS_FA: Record<CycleStatus, string> = {
  valid: "معتبر",
  suspect: "نیازمند بررسی (تلورانس)",
  incomplete: "ناتمام",
  recovered: "بازیابی‌شده",
};

/** چرخه مشتق‌شده از رویدادها — TS-004 + TS-005. */
export interface DerivedCycle {
  seq: number; // ۱-مبنا
  status: CycleStatus;
  startedAtEventId: string;
  endedAtEventId: string | null; // null = هنوز باز
  startedElapsedMs: number;
  endedElapsedMs: number | null;
  /** زمان چرخه مشاهده‌شده (فعال، بدون مکث) — TS-004 */
  cycleTimeMs: number | null;
  elements: ElementObservation[];
  /** جمع مدت عناصر — برای کنترل TS-005 */
  elementsSumMs: number;
  /** انحراف نسبی |Σd − C| ÷ C (درصد) — null اگر C ناموجود */
  deviationPct: number | null;
  interruptions: InterruptionRecord[];
  flags: IntegrityFlag[];
}

/** جمع‌بندی جلسه مشتق‌شده. */
export interface DerivedSessionSummary {
  phase: SessionPhase;
  currentCycleNo: number;
  cycles: DerivedCycle[];
  completedCycles: number;
  /** زمان فعال کل (بدون مکث) */
  activeMs: number;
  /** مدت مکث کل (از ساعت دیواری؛ اجزای نامشخص جدا گزارش می‌شوند) */
  pausedMs: number | null;
  eventCount: number;
  flags: IntegrityFlag[];
  interruptions: InterruptionRecord[];
  startedAtWall: string | null;
  endedAtWall: string | null;
}

// ─────────────────────── قالب‌بندی فارسی زمان ───────────────────────

/** قالب‌بندی مدت میلی‌ثانیه به شکل خوانا mm:ss.cc یا h:mm:ss.cc (لاتین-رقمی برای تمایز). */
export function formatDurationMs(ms: number): string {
  const safe = Number.isFinite(ms) && ms >= 0 ? ms : 0;
  const totalSec = Math.floor(safe / 1000);
  const cs = Math.floor((safe % 1000) / 10);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const cc = String(cs).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}.${cc}` : `${mm}:${ss}.${cc}`;
}

/** مدت کوتاه برای نشان/برچسب — «۲٫۴s» سبک. */
export function formatShortMs(ms: number): string {
  const safe = Number.isFinite(ms) && ms >= 0 ? ms : 0;
  if (safe < 60_000) return `${(safe / 1000).toFixed(2)}s`;
  return formatDurationMs(safe);
}
