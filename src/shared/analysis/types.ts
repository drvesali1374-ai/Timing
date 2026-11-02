/**
 * انواع هسته تحلیل (فاز ۵ · بخش B9/B4 سند جامع · ENGINE_CONTRACTS §۵).
 *
 * این ماژول خالص است: بدون DOM، بدون Prisma، بدون وابستگی به ماژول‌های سرور —
 * هم در آزمون واحد (bun test)، هم مرورگر و هم سرور اجرا می‌شود.
 *
 * مرجع روش‌شناختی (با تاریخ بازبینی — RESEARCH_LOG):
 *  - آمار توصیفی/استنباطی پایه (میانگین/میانه/انحراف معیار نمونه n−1/CV/چندک):
 *    روش استاندارد آمار — مثلاً NIST/SEMATECH e-Handbook (بازبینی ۲۰۲۶-۱۰-۳۱).
 *  - قاعده پرت IQR (Tukey fences، k=۱٫۵): Tukey, J. W. (1977) «Exploratory Data Analysis».
 *  - قاعده z-score (|z|>۳): روش رایج غربال سه-سیگمایی — صرفاً «مشکوک»، نه اثبات پرت.
 *  - فاصله اطمینان تقریب نرمال x̄ ± z·s/√n و کفایت نمونه n_req=(z·CV/e)²:
 *    آمار استاندارد؛ فرض‌ها صریح ثبت می‌شوند (معیار پذیرش B9: «زمانی که فرض‌های
 *    روش آماری معتبر باشند»).
 *  - زنجیره زمان B4: TS-001/002/010/011/012 — FORMULA_CATALOG.md.
 */

import type { CycleStatus, IntegrityFlag, TimingMethod } from "@/shared/timing/types";

// ─────────────────────── روش تجمیع (agg.method) ───────────────────────

export type AggregationMethod = "mean" | "median" | "outlierRule";

export const AGGREGATION_METHODS: readonly AggregationMethod[] = ["mean", "median", "outlierRule"];

export function isAggregationMethod(v: unknown): v is AggregationMethod {
  return typeof v === "string" && (AGGREGATION_METHODS as readonly string[]).includes(v);
}

export const AGGREGATION_METHOD_LABELS_FA: Record<AggregationMethod, string> = {
  mean: "میانگین (TS-001)",
  median: "میانه (TS-002)",
  outlierRule: "حذف پرت‌ها بر قاعده و سپس تجمیع",
};

// ─────────────────────── قاعده تشخیص پرت ───────────────────────

export type OutlierRuleId = "iqr-1.5" | "z-3";

export const OUTLIER_RULES: readonly OutlierRuleId[] = ["iqr-1.5", "z-3"];

export function isOutlierRuleId(v: unknown): v is OutlierRuleId {
  return typeof v === "string" && (OUTLIER_RULES as readonly string[]).includes(v);
}

export const OUTLIER_RULE_LABELS_FA: Record<OutlierRuleId, string> = {
  "iqr-1.5": "IQR توکی (k=۱٫۵)",
  "z-3": "z-score (|z|>۳)",
};

export const OUTLIER_RULE_SOURCES_FA: Record<OutlierRuleId, string> = {
  "iqr-1.5": "Tukey (۱۹۷۷) — Exploratory Data Analysis، حصار ۱٫۵×IQR",
  "z-3": "غربال سه-سیگمایی رایج — صرفاً «مشکوک»، نه اثبات پرت",
};

// ─────────────────────── قرارداد مجاز زمان (B4) ───────────────────────

export type AllowanceMethod = "on-normal" | "on-standard";

export const ALLOWANCE_METHODS: readonly AllowanceMethod[] = ["on-normal", "on-standard"];

export function isAllowanceMethod(v: unknown): v is AllowanceMethod {
  return typeof v === "string" && (ALLOWANCE_METHODS as readonly string[]).includes(v);
}

export const ALLOWANCE_METHOD_LABELS_FA: Record<AllowanceMethod, string> = {
  "on-normal": "درصد از زمان نرمال — ST = NT × (۱ + r)",
  "on-standard": "درصد از زمان استاندارد — ST = NT ÷ (۱ − r)",
};

/** پایه درصد هر قرارداد — B4: «رابط کاربری باید پایه درصد را روشن کند». */
export const ALLOWANCE_BASE_FA: Record<AllowanceMethod, string> = {
  "on-normal": "پایه درصد: زمان نرمال (۱۰۰٪ = NT)",
  "on-standard": "پایه درصد: زمان استاندارد (۱۰۰٪ = ST)",
};

// ─────────────────────── تنظیمات صریح پروژه ───────────────────────

export interface AnalysisSettings {
  aggMethod: AggregationMethod;
  /** قاعده پرت برای agg.method=outlierRule — پیش‌فرض محصول: iqr-1.5 */
  outlierRule: OutlierRuleId;
  ratingEnabled: boolean;
  /** ضریب ارزیابی عملکرد (درصد؛ ۱۰۰ = متعارف ⇔ ضریب ۱) */
  ratingFactorPct: number;
  allowanceMethod: AllowanceMethod;
  /** نرخ مجاز (درصد) — پیشنهادی/سازمانی، نه استاندارد جهانی */
  allowanceRatePct: number;
  /** سطح اطمینان (درصد) — ۹۰/۹۵/۹۹ پشتیبانی می‌شوند */
  confidencePct: number;
  /** دقت هدف نسبی (درصد میانگین) برای کفایت نمونه */
  targetPrecisionPct: number;
}

/** z-value سطح‌های اطمینان پشتیبانی‌شده (تقریب نرمال). */
export const CONFIDENCE_Z: Record<number, number> = { 90: 1.645, 95: 1.96, 99: 2.576 };

export const CONFIDENCE_LEVELS: readonly number[] = [90, 95, 99];

// ─────────────────────── مشاهده تحلیل ───────────────────────

/** یک مشاهده عنصر از چرخه نهایی‌شده — ورودی تحلیل (ردیابی کامل). */
export interface AnalysisObservation {
  sessionId: string;
  sessionMethod: TimingMethod | "manual";
  observer: string;
  cycleSeq: number;
  cycleStatus: CycleStatus;
  elementKey: string;
  elementName: string;
  /** مدت فعال عنصر (ms) — TS-003 */
  durationMs: number;
  /** رویداد قرائت مبنای مشاهده — هویت ردیابی (برای داده دستی: شناسه مشاهده) */
  readingEventId: string;
  corrected: boolean;
  flags: IntegrityFlag[];
  /** زمینه جلسه (پارامترهای سفارشی scopeType=session مثل study.operator) */
  sessionContext: Record<string, string>;
  /** منبع ثبت مشاهده (ADR-017): کرنومتر داخلی یا ورود دستی/چسباندن/درون‌ریزی */
  source?: "chronometer" | "manual" | "paste" | "import";
}

/** وضعیت علامت/حذف یک مشاهده — دو عمل جدا (بند ۲ فاز ۵). */
export interface ObservationMarkState {
  /** علامت «داده پرت/مشکوک» — فقط برچسب؛ حذف نیست */
  outlierMarked: boolean;
  /** حذف از محاسبه — عملی جدا با علت ثبت‌شده */
  excluded: boolean;
  reason: string | null;
  markedBy: string;
  markedAt: string;
}

export interface MarkedObservation extends AnalysisObservation {
  mark: ObservationMarkState | null;
}

// ─────────────────────── آمار توصیفی (B9) ───────────────────────

export interface DescriptiveStats {
  n: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  range: number | null;
  /** انحراف معیار نمونه (n−1) — null وقتی n<۲ (تعریف نشده) */
  stddev: number | null;
  /** ضریب تغییرات s/x̄ — null وقتی mean=0 یا n<۲ */
  cv: number | null;
  q1: number | null;
  q3: number | null;
}

export interface HistogramBin {
  /** بازه [from, to) — بازه آخر بسته */
  from: number;
  to: number;
  count: number;
}

export interface Histogram {
  bins: HistogramBin[];
  binWidth: number;
  /** روش انتخاب تعداد بازه — برای شفافیت گزارش */
  methodFa: string;
}

/** نتیجه تشخیص پرت — فقط «شناسایی»؛ حذف خودکار نیست (B9). */
export interface OutlierDetection {
  rule: OutlierRuleId;
  /** نمایه‌های مشاهدات مشکوک در آرایه ورودی */
  suspectIndices: number[];
  /** مرزهای قاعده برای نمایش علت */
  boundsFa: string;
  sourceFa: string;
}

/** فاصله اطمینان میانگین (تقریب نرمال). */
export interface ConfidenceInterval {
  levelPct: number;
  z: number;
  mean: number;
  halfWidth: number | null;
  low: number | null;
  high: number | null;
  n: number;
  /** فرض‌ها/محدودیت — صادقانه */
  assumptionsFa: string[];
}

/** کفایت حجم نمونه (ST-010). */
export interface SampleAdequacy {
  targetPrecisionPct: number;
  confidencePct: number;
  requiredN: number | null;
  currentN: number;
  sufficient: boolean | null;
  assumptionsFa: string[];
}

export interface SampleQuality {
  cv: number | null;
  ci: ConfidenceInterval | null;
  adequacy: SampleAdequacy | null;
  warningsFa: string[];
}

// ─────────────────────── شمارش‌های شفافیت ───────────────────────

export interface ObservationCounts {
  /** همه مشاهدات تجمیع‌شده از جلسات نهایی‌شده */
  total: number;
  /** قابل استفاده (چرخه valid/suspect/recovered — بدون چرخه‌های ناتمام) */
  usable: number;
  /** حذف‌شده با علامت کاربر (با علت) */
  userExcluded: number;
  /** مشاهدات چرخه‌های ناتمام — داده ناقص، خودکار کنار گذاشته می‌شود */
  incompleteCycle: number;
  /** مشکوک به پرت بر قاعده انتخاب‌شده (فقط شناسایی) */
  ruleSuspect: number;
  /** n مؤثر وارد شده به محاسبه نماینده */
  effective: number;
  /** مشاهدات دارای پرچم یکپارچگی (نیازمند بررسی) */
  flagged: number;
  /** اصلاح‌شده (رویداد correction اعمال شده) */
  corrected: number;
}

// ─────────────────────── زنجیره زمان (B4) ───────────────────────

export type ChainStepStatus = "valid" | "incomplete" | "invalid";

export interface ChainStep<T> {
  status: ChainStepStatus;
  value: T | null;
  unit: string;
  warningsFa: string[];
  /** برچسب صادقانه — مثلاً «زمان خام (بدون ارزیابی عملکرد)» */
  labelFa: string;
}

/** خروجی گام «زمان نماینده». */
export interface RepresentativeStep extends ChainStep<number> {
  method: AggregationMethod;
  /** n مؤثر ورودی به تجمیع */
  effectiveN: number;
  /** نمایه‌های کنارگذاشته با قاعده (agg=outlierRule) */
  ruleExcludedIndices: number[];
}

/** خروجی گام «زمان نرمال». */
export interface NormalStep extends ChainStep<number> {
  ratingApplied: boolean;
  ratingFactorPct: number | null;
}

/** خروجی گام «زمان استاندارد». */
export interface StandardStep extends ChainStep<number> {
  allowanceMethod: AllowanceMethod;
  allowanceRatePct: number | null;
  /** پایه درصد — B4 */
  baseFa: string;
}

/** زنجیره کامل یک عنصر. */
export interface TimeChain {
  representative: RepresentativeStep;
  normal: NormalStep;
  standard: StandardStep;
}

// ─────────────────────── نتیجه تحلیل عنصر ───────────────────────

export interface FormulaEvalTrace {
  formulaKey: string;
  formulaSemver: string;
  status: ChainStepStatus;
  value: number | null;
  unit: string;
  errorsFa: string[];
}

export interface ElementAnalysis {
  elementKey: string;
  elementName: string;
  /** نام‌های دیده‌شده در جلسات مختلف (اسنپ‌شات تاریخی) */
  nameVariants: string[];
  observations: MarkedObservation[];
  counts: ObservationCounts;
  stats: DescriptiveStats;
  histogram: Histogram | null;
  outlierDetection: OutlierDetection | null;
  quality: SampleQuality;
  chain: TimeChain;
  /** ارزیابی فرمول‌های زنجیره از snapshot پروژه — ردیابی نسخه */
  formulaTrace: FormulaEvalTrace[];
}

// ─────────────────────── جمع‌بندی چرخه/مقایسه ───────────────────────

export interface SessionAnalysisSummary {
  sessionId: string;
  method: TimingMethod | "manual";
  /** منبع داده — کرنومتر یا برگه دستی (ADR-017) */
  source?: "chronometer" | "manual";
  /** عنوان برگه (فقط منبع دستی) */
  title?: string | null;
  observer: string;
  status: string;
  cyclesTotal: number;
  cyclesValid: number;
  cyclesSuspect: number;
  cyclesRecovered: number;
  cyclesIncomplete: number;
  observationsCount: number;
  /** زمان چرخه مشاهده‌شده — TS-004 (میانگین چرخه‌های کامل) */
  meanCycleTimeMs: number | null;
  startedAtWall: string | null;
  sessionContext: Record<string, string>;
}

/** تفکیک آماری بر بعد دلخواه (جلسه/روش/ناظر/زمینه سفارشی). */
export interface BreakdownGroup {
  dimension: string;
  value: string;
  n: number;
  mean: number | null;
  median: number | null;
  cv: number | null;
}
