/**
 * انواع دامنه موتور بالانس خط (B10 — فاز ۶) — هسته خالص مشترک.
 *
 * قاعده مرزها (ENGINE_CONTRACTS بند ۵): موتور از UI و از Prisma مستقل است —
 * ورودی/خروجی داده محض. منبع قرارداد: ENGINE_CONTRACTS «BalanceProblem/Solution»
 * و ADR-008 (LCR + RPW + Kilbridge–Wester + Manual؛ بدون MILP در پایه).
 *
 * جداسازی زمان‌ها (بند ۱/۷ دستور فاز ۶):
 *  - مبنای زمان انتخابی (observed/representative/normal/standard/override) جدا از
 *    «ترکیب زمان» فعالیت است (دستی/ماشینی/انتظار/هم‌پوشان) — دو محور مستقل.
 *  - زمان machineAuto هرگز به کار دستی اپراتور جمع نمی‌شود؛ بار ایستگاه «سریال»
 *    (دستی+ماشینی+انتظار، بدون هم‌پوشان) جدا از «بار اپراتور» گزارش می‌شود.
 * همه زمان‌ها میلی‌ثانیه (سازگار با فاز ۴/۵).
 */

// ─────────────────────── نوع کار (هم‌ارز مجموعه B5 — مستقل در هسته) ───────────────────────

export const BALANCE_WORK_TYPES = [
  "operatorManual",
  "machineAuto",
  "waiting",
  "transport",
  "inspection",
  "setupChangeover",
  "overlap",
] as const;
export type BalanceWorkType = (typeof BALANCE_WORK_TYPES)[number];

export const BALANCE_WORK_TYPE_LABELS_FA: Record<BalanceWorkType, string> = {
  operatorManual: "دستی اپراتور",
  machineAuto: "خودکار ماشین",
  waiting: "انتظار/تأخیر",
  transport: "حرکت/جابه‌جایی",
  inspection: "بازرسی",
  setupChangeover: "راه‌اندازی/تعویض",
  overlap: "هم‌پوشان",
};

export function isBalanceWorkType(v: unknown): v is BalanceWorkType {
  return typeof v === "string" && (BALANCE_WORK_TYPES as readonly string[]).includes(v);
}

// ─────────────────────── مبنای زمان انتخابی ───────────────────────

export const TIME_BASES = ["observed", "representative", "normal", "standard", "override"] as const;
export type TimeBasis = (typeof TIME_BASES)[number];

export const TIME_BASIS_LABELS_FA: Record<TimeBasis, string> = {
  observed: "مشاهده‌شده (میانگین مشاهدات معتبر)",
  representative: "نماینده (تجمیع قاعده‌مند)",
  normal: "نرمال (با ارزیابی عملکرد)",
  standard: "استاندارد (با هزینه‌مجوز)",
  override: "بازتنظیم دستی سناریو",
};

// ─────────────────────── فعالیت مسئله بالانس ───────────────────────

export interface BalanceActivity {
  /** شناسه فنی پایدار فعالیت (stableKey B5) */
  id: string;
  name: string;
  /** زمان بر مبنای انتخابی — ms */
  timeMs: number;
  workType: BalanceWorkType;
  /** پیش‌نیازها (stableKey فعالیت‌های مقدم) */
  predecessors: string[];
  /** ایستگاه ترجیحی ۱-مبنا (نرم — فقط گزارش/هشدار؛ الگوریتم‌های کلاسیک از آن استفاده نمی‌کنند) */
  stationHint: number | null;
  /** فعالیت‌های ناسازگار — نمی‌توانند در یک ایستگاه باشند (B10 «ناسازگاری وظایف») */
  incompatibleWith: string[];
  /** منبع زمان — ردیابی صادقانه */
  timeSource: "analysis" | "override" | "missing";
  /** وضعیت داده زمان: missing = بدون عدد جعلی، از تخصیص کنار گذاشته می‌شود */
  timeStatus: "valid" | "missing";
  /** یادداشت منبع زمان برای UI */
  timeSourceFa: string;
}

// ─────────────────────── تاکت ───────────────────────

/** تاکت: مستقیم یا از تقاضا — Takt = زمان خالص در دسترس ÷ تقاضا (فرمول مستند) */
export interface TaktInput {
  /** تاکت مستقیم — ms (اولویت اگر موجود) */
  taktMs?: number | null;
  /** تقاضا: واحد در دوره */
  demandUnits?: number | null;
  /** زمان خالص در دسترس هر شیفت — ms (خالص = منهای وقفه‌های برنامه‌ریزی‌شده) */
  netAvailableMsPerShift?: number | null;
  /** تعداد شیفت در دوره */
  shiftsPerPeriod?: number | null;
}

export interface TaktResolution {
  taktMs: number;
  sourceFa: string;
  formulaFa: string | null;
  warningsFa: string[];
}

// ─────────────────────── اهداف ───────────────────────

export interface ObjectiveWeights {
  /** وزن کمینه‌سازی تعداد ایستگاه (۰ تا ۱) */
  minimizeStations: number;
  /** وزن یکنواختی بار ایستگاه‌ها (۰ تا ۱) */
  smoothLoad: number;
  /** وزن کمینه‌سازی تغییر نسبت به تخصیص مرجع/وضع موجود (۰ تا ۱) */
  minChanges: number;
}

// ─────────────────────── مسئله ───────────────────────

export interface BalanceProblem {
  activities: BalanceActivity[];
  taktMs: number;
  taktSourceFa: string;
  /** سقف ایستگاه‌های موجود/فضایی — null = نامحدود */
  maxStations: number | null;
  objectives: ObjectiveWeights;
  /** تخصیص مرجع «وضع موجود» (activityId → ایستگاه ۱-مبنا) — برای minChanges و مقایسه قبل/بعد */
  referenceAssignment: Record<string, number> | null;
}

// ─────────────────────── راهکار ───────────────────────

export const BALANCE_ALGORITHM_IDS = ["lcr", "rpw", "kilbridge-wester", "manual"] as const;
export type BalanceAlgorithmId = (typeof BALANCE_ALGORITHM_IDS)[number];

export interface StationLoad {
  /** ۱-مبنا */
  station: number;
  activityIds: string[];
  /** Σ زمان کار دستی اپراتور (operatorManual/inspection/transport/setupChangeover) */
  operatorMs: number;
  /** Σ زمان خودکار ماشین (machineAuto) — جدا از کار اپراتور */
  machineMs: number;
  /** Σ زمان انتظار (waiting) */
  waitMs: number;
  /** بار سریال = دستی + ماشینی + انتظار (بدون هم‌پوشان) — مبنای مقایسه با تاکت */
  serialMs: number;
  /** Σ زمان فعالیت‌های هم‌پوشان — جمع نمی‌شود (فرض هم‌زمانی) — گزارش جدا */
  overlapMs: number;
  /** بیکاری = تاکت − سریال (منفی = اضافه‌بار) */
  idleMs: number;
  /** بار سریال نسبت به تاکت — درصد */
  loadPctOfTakt: number;
  /** اشتغال اپراتور = operatorMs ÷ تاکت — درصد (مقایسه با ۱۰۰) */
  operatorLoadPct: number;
}

export type ViolationCode =
  | "precedence"
  | "capacity"
  | "incompatible"
  | "unknown-activity"
  | "duplicate-assignment"
  | "missing-activity"
  | "station-count"
  | "task-exceeds-takt";

export interface ConstraintViolation {
  code: ViolationCode;
  activityId?: string;
  station?: number;
  messageFa: string;
}

export interface BalanceMetrics {
  /** ایستگاه‌های به‌کاررفته */
  stationCount: number;
  totalSerialMs: number;
  totalOperatorMs: number;
  totalMachineMs: number;
  totalWaitMs: number;
  totalOverlapMs: number;
  /** بیشینه بار سریال ایستگاه */
  bottleneckMs: number;
  /**
   * راندمان بالانس E = ΣT_serial ÷ (m × bottleneck)
   * مخرج: تعداد ایستگاه × بیشینه بار (تعریف کلاسیک Moodie-Young/انجمن مهندسان).
   */
  efficiencyPct: number | null;
  /** تأخیر بالانس d = ۱ − E */
  delayPct: number | null;
  /**
   * حداقل نظری ایستگاه‌ها mMin = ceil(ΣT_serial ÷ takt)
   * فرض‌ها: بدون تجزیه فعالیت، همه فعالیت‌ها ≤ تاکت، نادیده‌گرفتن قیود منطقی/فضایی.
   */
  minStationsTheoretical: number | null;
  totalIdleMs: number;
  idlePerStationMs: number[];
  /** نیروی نظری هر شیفت = ceil(ΣT_operator ÷ takt) — کران پایین (بدون قیود) */
  theoreticalOperators: number | null;
  /** نیروی عملیاتی = Σ اپراتور هر ایستگاه (فرض: ۱ اپراتور در ایستگاه دستی) */
  operationalOperators: number;
  /** اشتغال کل اپراتورها = ΣT_operator ÷ (m × takt) — درصد */
  operatorUtilizationPct: number | null;
  /** تعداد فعالیت جابه‌جاشده نسبت به مرجع — null بدون مرجع */
  changesVsReference: number | null;
  /** مقدار تابع هدف وزنی — کمتر بهتر (نرمال‌سازی مستند در guide) */
  objectiveValue: number | null;
}

export type BalanceStatus = "solved" | "solved-with-flags" | "infeasible-flagged";

export interface BalanceSolution {
  algorithm: BalanceAlgorithmId;
  algorithmLabelFa: string;
  algorithmVersion: string;
  /** activityId → شماره ایستگاه ۱-مبنا */
  assignments: Record<string, number>;
  stations: StationLoad[];
  metrics: BalanceMetrics;
  violations: ConstraintViolation[];
  /** تعداد قیود بررسی‌شده رعایت‌شده (تقدم‌ها + ظرفیت‌ها + ناسازگاری‌ها) */
  respectedConstraintsCount: number;
  runMs: number;
  status: BalanceStatus;
  /** یادداشت‌های روش/فرض — صداقت (ADR-008: «بهترین راهکار یافت‌شده» نه «بهینه») */
  notesFa: string[];
}

// ─────────────────────── نتیجه گراف تقدم ───────────────────────

export interface PrecedenceGraphCheck {
  ok: boolean;
  /** چرخه‌های یافت‌شده (هر کدام مسیر چرخه) */
  cycles: string[][];
  /** ارجاع به فعالیت ناموجود */
  unknownRefs: Array<{ from: string; ref: string }>;
  /** خودارجاعی */
  selfRefs: string[];
  /** پیش‌نیاز تکراری */
  duplicateRefs: Array<{ from: string; ref: string }>;
  /** فعالیت‌های غیرقابل زمان‌بندی (در چرخه یا وابسته به چرخه) */
  unschedulable: string[];
  /** رتبه ستون توپولوژیک هر فعالیت (۰-مبنا) — Kilbridge–Wester + رسم گراف */
  columns: Record<string, number>;
  /** ترتیب توپولوژیک پایدار (تی‌شرت با stableKey) */
  topologicalOrder: string[];
  messagesFa: string[];
}

export interface SolveOptions {
  algorithm: BalanceAlgorithmId;
  /** تخصیص کاربر — فقط برای manual */
  assignment?: Record<string, number>;
  /** سقف زمان اجرا — ثبت صرف (الگوریتم‌های پایه قطعی‌اند) */
  timeBudgetMs?: number;
}
