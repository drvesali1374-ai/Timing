/**
 * زنجیره زمان (فاز ۵ · B4) — مشاهده‌شده ← نماینده ← نرمال ← استاندارد.
 *
 * پیاده‌سازی «جواب مستقل» هسته برای آزمون داده مرجع (معیار پذیرش R5-1).
 * در سرویس، همین زنجیره از مسیر «موتور فرمول فاز ۲» (TS-001/002/010/011/012)
 * نیز ارزیابی می‌شود تا نسخه فرمول ردیابی‌پذیر باشد؛ اختلاف دو مسیر،
 * هشدار صادقانه می‌گیرد نه پوشش.
 *
 * قواعد صداقت (B4):
 *  - بدون ارزیابی عملکرد → خروجی «زمان خام» با وضعیت incomplete — نه «زمان نرمال قطعی».
 *  - داده/پارامتر نبودن → وضعیت incomplete + هشدار، نه عدد جعلی.
 *  - دو قرارداد مجاز یکی نیستند؛ پایه درصد صریح است.
 *  - r≥۱۰۰٪ در قرارداد on-standard → invalid (تقسیم بر صفر/منفی بی‌معنا).
 */

import {
  detectOutliers,
  mean as statMean,
  median as statMedian,
} from "./stats";
import type {
  AnalysisSettings,
  MarkedObservation,
  NormalStep,
  ObservationCounts,
  RepresentativeStep,
  StandardStep,
  TimeChain,
} from "./types";
import { ALLOWANCE_BASE_FA, ALLOWANCE_METHOD_LABELS_FA } from "./types";

// ─────────────────────── شمارش‌های شفافیت ───────────────────────

/** چرخه‌های valid/suspect/recovered قابل استفاده‌اند؛ incomplete داده ناقص است. */
const USABLE_CYCLE_STATUSES = new Set(["valid", "suspect", "recovered"]);

/**
 * تفکیک شفاف مشاهدات — شمارش هر وضعیت جداگانه گزارش می‌شود
 * (بند ۲ فاز ۵: مدیریت داده ناقص؛ شمارش‌ها هرگز حذف خاموش ندارند).
 */
export function countObservations(observations: readonly MarkedObservation[], settings: AnalysisSettings): ObservationCounts & { usableValues: number[]; usableIndices: number[]; ruleSuspectIndices: number[] } {
  const usableIndices: number[] = [];
  const usableValues: number[] = [];
  let userExcluded = 0;
  let incompleteCycle = 0;
  let flagged = 0;
  let corrected = 0;

  observations.forEach((o, i) => {
    if (o.corrected) corrected += 1;
    if (o.flags.length > 0) flagged += 1;
    if (!USABLE_CYCLE_STATUSES.has(o.cycleStatus)) {
      incompleteCycle += 1;
      return;
    }
    if (o.mark?.excluded) {
      userExcluded += 1;
      return;
    }
    usableIndices.push(i);
    usableValues.push(o.durationMs);
  });

  // تشخیص پرت بر قاعده — فقط روی مجموعه قابل استفاده (شناسایی، نه حذف)
  const ruleSuspectIndices = detectOutliers(usableValues, settings.outlierRule)?.suspectIndices ?? [];

  const effective = settings.aggMethod === "outlierRule" ? usableValues.length - ruleSuspectIndices.length : usableValues.length;

  return {
    total: observations.length,
    usable: usableValues.length,
    userExcluded,
    incompleteCycle,
    ruleSuspect: ruleSuspectIndices.length,
    effective,
    flagged,
    corrected,
    usableValues,
    usableIndices,
    ruleSuspectIndices,
  };
}

// ─────────────────────── گام ۲: زمان نماینده ───────────────────────

/**
 * زمان نماینده عنصر از مشاهدات مؤثر (بند ۲ فاز ۵ + TS-001/002).
 * - mean → میانگین (TS-001) · median → میانه (TS-002)
 * - outlierRule → کنارگذاشتن «مشکوک‌های قاعده» و سپس تجمیع با میانگین
 *   (قاعده انتخاب‌شده ثبت و نمایش داده می‌شود — حذف خودکارِ بی‌قاعده نیست)
 */
export function computeRepresentative(
  usableValues: readonly number[],
  settings: AnalysisSettings,
  ruleSuspectIndices: readonly number[],
): RepresentativeStep {
  const warnings: string[] = [];
  let effectiveValues: number[] = [...usableValues];

  if (settings.aggMethod === "outlierRule" && ruleSuspectIndices.length > 0) {
    const suspectSet = new Set(ruleSuspectIndices);
    effectiveValues = usableValues.filter((_, i) => !suspectSet.has(i));
    warnings.push(
      `${ruleSuspectIndices.length} مشاهده «مشکوک بر قاعده ${settings.outlierRule}» از تجمیع کنار گذاشته شد — علت قاعده ثبت و در جدول مشاهدات قابل بازبینی است (علامت حذف جدا از علامت پرت است).`,
    );
  }

  if (effectiveValues.length === 0) {
    return {
      status: "incomplete",
      value: null,
      unit: "ms",
      warningsFa: ["هیچ مشاهده مؤثری برای تجمیع وجود ندارد — زمان نماینده تعریف‌نشده است.", ...warnings],
      labelFa: "زمان نماینده — تکمیل‌نشده (بی‌داده)",
      method: settings.aggMethod,
      effectiveN: 0,
      ruleExcludedIndices: [...ruleSuspectIndices],
    };
  }

  const value = settings.aggMethod === "median" ? statMedian(effectiveValues) : statMean(effectiveValues);
  if (value === null) {
    return {
      status: "invalid",
      value: null,
      unit: "ms",
      warningsFa: ["تجمیع روی داده معتبر مقدار تولید نکرد."],
      labelFa: "زمان نماینده — نامعتبر",
      method: settings.aggMethod,
      effectiveN: effectiveValues.length,
      ruleExcludedIndices: [...ruleSuspectIndices],
    };
  }

  if (effectiveValues.length < 2) {
    warnings.push("تنها یک مشاهده مؤثر — زمان نماینده همان مقدار تک‌مشاهده است و پراکندگی قابل قضاوت نیست.");
  }
  if (settings.aggMethod === "median" && effectiveValues.length < 2) {
    warnings.push("میانه با n=۱ همان مقدار است (FORMULA_CATALOG TS-002: نیازمند حداقل یک مشاهده).");
  }

  return {
    status: "valid",
    value,
    unit: "ms",
    warningsFa: warnings,
    labelFa: `زمان نماینده — ${settings.aggMethod === "median" ? "میانه" : settings.aggMethod === "mean" ? "میانگین" : "میانگین پس از قاعده پرت"} (${effectiveValues.length} مشاهده مؤثر)`,
    method: settings.aggMethod,
    effectiveN: effectiveValues.length,
    ruleExcludedIndices: [...ruleSuspectIndices],
  };
}

// ─────────────────────── گام ۳: زمان نرمال ───────────────────────

/**
 * زمان نرمال (TS-010): NT = RT × (RF ÷ ۱۰۰) — فقط با ارزیابی فعال.
 * بدون ارزیابی → «زمان خام» با وضعیت incomplete (B4: از نامیدن به نرمال قطعی خودداری کن).
 */
export function computeNormal(rep: RepresentativeStep, settings: AnalysisSettings): NormalStep {
  if (rep.value === null) {
    return {
      status: "incomplete",
      value: null,
      unit: "ms",
      warningsFa: ["به‌دلیل نبود زمان نماینده، زمان نرمال محاسبه نمی‌شود."],
      labelFa: "زمان نرمال — تکمیل‌نشده",
      ratingApplied: false,
      ratingFactorPct: null,
    };
  }
  if (!settings.ratingEnabled) {
    return {
      status: "incomplete",
      value: rep.value,
      unit: "ms",
      warningsFa: [
        "ارزیابی عملکرد غیرفعال است — این مقدار «زمان خام» است و برچسب «زمان نرمال قطعی» نمی‌گیرد (B4).",
      ],
      labelFa: "زمان خام (بدون ارزیابی عملکرد)",
      ratingApplied: false,
      ratingFactorPct: null,
    };
  }
  const factor = settings.ratingFactorPct / 100;
  return {
    status: "valid",
    value: rep.value * factor,
    unit: "ms",
    warningsFa:
      settings.ratingFactorPct === 100
        ? ["ضریب ارزیابی ۱۰۰٪ (=۱٫۰) — زمان نرمال برابر زمان نماینده است."]
        : [],
    labelFa: `زمان نرمال — NT = RT × (RF÷۱۰۰) با RF=${settings.ratingFactorPct}٪`,
    ratingApplied: true,
    ratingFactorPct: settings.ratingFactorPct,
  };
}

// ─────────────────────── گام ۴: زمان استاندارد ───────────────────────

/**
 * زمان استاندارد (TS-011/TS-012) — دو قرارداد نابرابر (B4):
 *  - on-normal:   ST = NT × (۱ + r) — پایه درصد: زمان نرمال
 *  - on-standard: ST = NT ÷ (۱ − r) — پایه درصد: زمان استاندارد (r<۱۰۰ الزامی)
 */
export function computeStandard(normal: NormalStep, settings: AnalysisSettings): StandardStep {
  const baseFa = ALLOWANCE_BASE_FA[settings.allowanceMethod];
  if (normal.value === null || normal.status === "incomplete") {
    return {
      status: "incomplete",
      value: null,
      unit: "ms",
      warningsFa: ["به‌دلیل نبود زمان نرمال معتبر، زمان استاندارد محاسبه نمی‌شود."],
      labelFa: "زمان استاندارد — تکمیل‌نشده",
      allowanceMethod: settings.allowanceMethod,
      allowanceRatePct: null,
      baseFa,
    };
  }
  const r = settings.allowanceRatePct / 100;
  if (settings.allowanceMethod === "on-standard") {
    if (settings.allowanceRatePct >= 100) {
      return {
        status: "invalid",
        value: null,
        unit: "ms",
        warningsFa: ["نرخ مجاز ≥۱۰۰٪ در قرارداد on-standard بی‌معنا است (مخرج صفر/منفی) — TS-012."],
        labelFa: "زمان استاندارد — نامعتبر (r≥۱۰۰٪)",
        allowanceMethod: settings.allowanceMethod,
        allowanceRatePct: settings.allowanceRatePct,
        baseFa,
      };
    }
    return {
      status: "valid",
      value: normal.value / (1 - r),
      unit: "ms",
      warningsFa: [],
      labelFa: `زمان استاندارد (on-standard) — ST = NT ÷ (۱−r) با r=${settings.allowanceRatePct}٪`,
      allowanceMethod: settings.allowanceMethod,
      allowanceRatePct: settings.allowanceRatePct,
      baseFa,
    };
  }
  return {
    status: "valid",
    value: normal.value * (1 + r),
    unit: "ms",
    warningsFa: [],
    labelFa: `زمان استاندارد (on-normal) — ST = NT × (۱+r) با r=${settings.allowanceRatePct}٪`,
    allowanceMethod: settings.allowanceMethod,
    allowanceRatePct: settings.allowanceRatePct,
    baseFa,
  };
}

// ─────────────────────── زنجیره کامل ───────────────────────

/** زنجیره کامل یک عنصر از مشاهدات نشانه‌خورده — قطعی و بدون عارضه جانبی. */
export function computeTimeChain(observations: readonly MarkedObservation[], settings: AnalysisSettings): TimeChain & { counts: ObservationCounts } {
  const counted = countObservations(observations, settings);
  const representative = computeRepresentative(counted.usableValues, settings, counted.ruleSuspectIndices);
  const normal = computeNormal(representative, settings);
  const standard = computeStandard(normal, settings);
  const { usableValues: _u, usableIndices: _i, ruleSuspectIndices: _r, ...counts } = counted;
  return { representative, normal, standard, counts };
}

/** برچسب قرارداد مجاز برای UI — پایه درصد روشن (بند ۴ فاز ۵). */
export function allowanceMethodLabelFa(method: AnalysisSettings["allowanceMethod"]): string {
  return ALLOWANCE_METHOD_LABELS_FA[method];
}
