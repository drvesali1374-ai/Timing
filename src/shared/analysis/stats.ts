/**
 * توابع آماری مستقل (فاز ۵ · B9) — خالص و بدون عارضه جانبی.
 * هر تابع قطعی است: ورودی یکسان → خروجی یکسان (قید قطعیت موتورها).
 *
 * منابع (بازبینی ۲۰۲۶-۱۰-۳۱ — RESEARCH_LOG):
 *  - میانگین/میانه/کمینه/بیشینه: ریاضی محض.
 *  - انحراف معیار نمونه با مخرج n−1 (تصحیح بسل): روش استاندارد آمار —
 *    NIST/SEMATECH e-Handbook §1.3.3.1 (بازبینی ۲۰۲۶-۱۰-۳۱).
 *  - چندک با درون‌یابی خطی (روش نوع ۷ — استاندارد رایج R/NumPy پیش‌فرض):
 *    Hyndman & Fan (1996) «Sample Quantiles in Statistical Packages».
 *  - حصار توکی: Tukey (1977) EDA — Q1−1.5×IQR و Q3+1.5×IQR.
 *  - z-score: غربال رایج |z|>۳ بر میانگین/انحراف نمونه — «مشکوک» نه «اثبات پرت».
 *  - CI نرمال: x̄ ± z·s/√n (z از جدول استاندارد)؛ فرض: نمونه تصادفی/تقریب نرمال.
 *  - کفایت نمونه: n_req = (z·CV/e)² — ST-010 (FORMULA_CATALOG).
 *
 * همه توابع با آرایه خالی/تك‌عضوی رفتار صادقانه دارند: مقدار تعریف‌نشده → null.
 */

import { CONFIDENCE_Z, type ConfidenceInterval, type DescriptiveStats, type Histogram, type OutlierDetection, type OutlierRuleId, type SampleAdequacy } from "./types";

// ─────────────────────── پایه‌ها ───────────────────────

/** مجموع — اعداد متناهی؛ نان/غیرمتناهی رد می‌شود. */
export function sum(xs: readonly number[]): number {
  let acc = 0;
  for (const x of xs) {
    if (Number.isFinite(x)) acc += x;
  }
  return acc;
}

/** میانگین حسابی — null برای آرایه خالی (TS-001). */
export function mean(xs: readonly number[]): number | null {
  const valid = xs.filter((x) => Number.isFinite(x));
  if (valid.length === 0) return null;
  return sum(valid) / valid.length;
}

/** میانه مرتب‌شده — null برای آرایه خالی (TS-002). */
export function median(xs: readonly number[]): number | null {
  const valid = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const n = valid.length;
  if (n === 0) return null;
  if (n % 2 === 1) return valid[(n - 1) / 2];
  return (valid[n / 2 - 1] + valid[n / 2]) / 2;
}

/** کمینه — null برای آرایه خالی. */
export function min(xs: readonly number[]): number | null {
  const valid = xs.filter((x) => Number.isFinite(x));
  if (valid.length === 0) return null;
  return Math.min(...valid);
}

/** بیشینه — null برای آرایه خالی. */
export function max(xs: readonly number[]): number | null {
  const valid = xs.filter((x) => Number.isFinite(x));
  if (valid.length === 0) return null;
  return Math.max(...valid);
}

/**
 * انحراف معیار نمونه با مخرج n−1 (ST-001) — null وقتی n<۲ (تعریف نشده).
 * تصحیح بسل: s = √(Σ(xᵢ−x̄)² ÷ (n−1)).
 */
export function sampleStddev(xs: readonly number[]): number | null {
  const valid = xs.filter((x) => Number.isFinite(x));
  const n = valid.length;
  if (n < 2) return null;
  const m = sum(valid) / n;
  const ss = valid.reduce((acc, x) => acc + (x - m) * (x - m), 0);
  return Math.sqrt(ss / (n - 1));
}

/** ضریب تغییرات CV = s ÷ x̄ (ST-002) — null وقتی n<۲ یا x̄=0. */
export function coefficientOfVariation(xs: readonly number[]): number | null {
  const s = sampleStddev(xs);
  const m = mean(xs);
  if (s === null || m === null || m === 0) return null;
  return s / Math.abs(m);
}

/**
 * چندک p∈[0,1] با درون‌یابی خطی (روش نوع ۷ — Hyndman & Fan 1996؛
 * پیش‌فرض R quantile type 7 / NumPy 'linear'). null برای آرایه خالی.
 */
export function quantile(xs: readonly number[], p: number): number | null {
  if (!(p >= 0 && p <= 1)) return null;
  const valid = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const n = valid.length;
  if (n === 0) return null;
  if (n === 1) return valid[0];
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return valid[lo];
  const frac = h - lo;
  return valid[lo] * (1 - frac) + valid[hi] * frac;
}

/** چارک اول Q1 (چندک ۰٫۲۵). */
export function q1(xs: readonly number[]): number | null {
  return quantile(xs, 0.25);
}

/** چارک سوم Q3 (چندک ۰٫۷۵). */
export function q3(xs: readonly number[]): number | null {
  return quantile(xs, 0.75);
}

/** دامنه — null برای آرایه خالی. */
export function rangeOf(xs: readonly number[]): number | null {
  const lo = min(xs);
  const hi = max(xs);
  if (lo === null || hi === null) return null;
  return hi - lo;
}

/** آمار توصیفی یک‌جا (B9: میانگین/میانه/کمینه/بیشینه/انحراف/CV/چندک). */
export function descriptiveStats(xs: readonly number[]): DescriptiveStats {
  return {
    n: xs.filter((x) => Number.isFinite(x)).length,
    mean: mean(xs),
    median: median(xs),
    min: min(xs),
    max: max(xs),
    range: rangeOf(xs),
    stddev: sampleStddev(xs),
    cv: coefficientOfVariation(xs),
    q1: q1(xs),
    q3: q3(xs),
  };
}

// ─────────────────────── هیستوگرام ───────────────────────

/**
 * هیستوگرام با قاعده Sturges برای تعداد بازه: k = ⌈1 + log₂(n)⌉ —
 * روش کلاسیک مناسب n کوچک/متوسط (بازبینی: NIST e-Handbook §1.3.3.6).
 * null برای n<۲ (بازه معنادار نمی‌شود).
 */
export function histogram(xs: readonly number[], requestedBins?: number): Histogram | null {
  const valid = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const n = valid.length;
  if (n < 2) return null;
  const lo = valid[0];
  const hi = valid[n - 1];
  const width = hi - lo;
  if (width === 0) {
    // همه مقادیر برابر — یک بازه
    return { bins: [{ from: lo, to: hi + 1, count: n }], binWidth: 1, methodFa: "همه مقادیر برابر — بازه واحد" };
  }
  const k = requestedBins && requestedBins >= 1 ? Math.floor(requestedBins) : Math.max(2, Math.ceil(1 + Math.log2(n)));
  const binWidth = width / k;
  const bins = Array.from({ length: k }, (_, i) => ({ from: lo + i * binWidth, to: lo + (i + 1) * binWidth, count: 0 }));
  for (const x of valid) {
    let idx = Math.floor((x - lo) / binWidth);
    if (idx >= k) idx = k - 1; // مقدار بیشینه در بازه آخر
    if (idx < 0) idx = 0;
    bins[idx].count += 1;
  }
  return { bins, binWidth, methodFa: `قاعده Sturges — ${k} بازه (n=${n})` };
}

// ─────────────────────── تشخیص داده پرت ───────────────────────

/**
 * تشخیص پرت با حصار توکی: خارج از [Q1−k×IQR ، Q3+k×IQR] با k=۱٫۵ (Tukey 1977).
 * فقط «شناسایی» — حذف خودکار نیست (B9). n<۴ → بدون حصار معتبر (null).
 */
export function detectOutliersIQR(xs: readonly number[], k = 1.5): { suspectIndices: number[]; bounds: [number, number] | null } {
  const n = xs.length;
  if (n < 4) return { suspectIndices: [], bounds: null };
  const q1v = q1(xs);
  const q3v = q3(xs);
  if (q1v === null || q3v === null) return { suspectIndices: [], bounds: null };
  const iqr = q3v - q1v;
  const lo = q1v - k * iqr;
  const hi = q3v + k * iqr;
  const suspectIndices: number[] = [];
  xs.forEach((x, i) => {
    if (Number.isFinite(x) && (x < lo || x > hi)) suspectIndices.push(i);
  });
  return { suspectIndices, bounds: [lo, hi] };
}

/**
 * تشخیص پرت با z-score نمونه: |x−x̄|/s > ۳ — غربال سه-سیگمایی.
 * n<۳ یا s=۰ → بدون معیار معتبر (null).
 */
export function detectOutliersZScore(xs: readonly number[], threshold = 3): { suspectIndices: number[]; bounds: [number, number] | null } {
  const n = xs.length;
  if (n < 3) return { suspectIndices: [], bounds: null };
  const m = mean(xs);
  const s = sampleStddev(xs);
  if (m === null || s === null || s === 0) return { suspectIndices: [], bounds: null };
  const suspectIndices: number[] = [];
  xs.forEach((x, i) => {
    if (Number.isFinite(x) && Math.abs((x - m) / s) > threshold) suspectIndices.push(i);
  });
  return { suspectIndices, bounds: [m - threshold * s, m + threshold * s] };
}

/** تشخیص پرت بر قاعده انتخاب‌شده — با مرزها و منبع برای نمایش علت. */
export function detectOutliers(xs: readonly number[], rule: OutlierRuleId): OutlierDetection | null {
  if (rule === "iqr-1.5") {
    const r = detectOutliersIQR(xs, 1.5);
    if (!r.bounds) return null;
    return {
      rule,
      suspectIndices: r.suspectIndices,
      boundsFa: `حصار توکی: [${r.bounds[0].toFixed(3)} ، ${r.bounds[1].toFixed(3)}] — بیرون از حصار «مشکوک» است`,
      sourceFa: "Tukey (۱۹۷۷) — Exploratory Data Analysis",
    };
  }
  const r = detectOutliersZScore(xs, 3);
  if (!r.bounds) return null;
  return {
    rule,
    suspectIndices: r.suspectIndices,
    boundsFa: `مرز z=±۳: [${r.bounds[0].toFixed(3)} ، ${r.bounds[1].toFixed(3)}] — بیرون از مرز «مشکوک» است`,
    sourceFa: "غربال سه-سیگمایی رایج — شناسایی، نه اثبات",
  };
}

// ─────────────────────── استنباط ───────────────────────

/**
 * فاصله اطمینان میانگین با تقریب نرمال: x̄ ± z·s/√n.
 * فرض‌ها صریح: نمونه تصادفی/مستقل، تقریب نرمال (n≥۳۰ توصیه می‌شود؛
 * برای n کوچک فقط «تقریب» قلمداد شود). n<۲ یا سطح ناشناخته → null.
 */
export function confidenceIntervalMean(xs: readonly number[], levelPct: number): ConfidenceInterval | null {
  const z = CONFIDENCE_Z[levelPct];
  if (z === undefined) return null;
  const m = mean(xs);
  const s = sampleStddev(xs);
  const n = xs.filter((x) => Number.isFinite(x)).length;
  if (m === null || s === null) {
    // بدون پراکندگی معتبر — فقط میانگین با هشدار
    if (m === null) return null;
    return {
      levelPct,
      z,
      mean: m,
      halfWidth: null,
      low: null,
      high: null,
      n,
      assumptionsFa: ["n<۲ — پراکندگی تعریف نشده؛ فاصله اطمینان گزارش نمی‌شود."],
    };
  }
  const half = (z * s) / Math.sqrt(n);
  return {
    levelPct,
    z,
    mean: m,
    halfWidth: half,
    low: m - half,
    high: m + half,
    n,
    assumptionsFa: [
      "تقریب نرمال (z) — برای n<۳۰ تقریب خشن است و با احتیاط تفسیر شود.",
      "فرض نمونه تصادفی و مستقل از فرایند پایدار.",
    ],
  };
}

/**
 * کفایت حجم نمونه: n_req = (z·CV ÷ e)² که CV نسبت و e دقت نسبی اعشاری
 * (ST-010). null وقتی CV تعریف نشده (n<۲ یا x̄=۰) — صادقانه.
 * «کافی» جهت قضاوت است، نه سقف قطعی (FORMULA_CATALOG ST-010).
 */
export function requiredSampleSize(
  cvRatio: number | null,
  targetPrecisionPct: number,
  levelPct: number,
  currentN: number,
): SampleAdequacy | null {
  const z = CONFIDENCE_Z[levelPct];
  if (z === undefined) return null;
  const assumptionsFa = [
    "تقریب نرمال بر CV مشاهده‌شده — CV واقعی نامعلوم است.",
    "عدد کفایت «جهت قضاوت» است، نه سقف قطعی؛ تغییرپذیری واقعی ممکن است متفاوت باشد.",
  ];
  if (cvRatio === null || !Number.isFinite(cvRatio)) {
    return { targetPrecisionPct, confidencePct: levelPct, requiredN: null, currentN, sufficient: null, assumptionsFa };
  }
  const e = targetPrecisionPct / 100;
  if (e <= 0) return null;
  const requiredN = Math.ceil((z * cvRatio / e) ** 2);
  return {
    targetPrecisionPct,
    confidencePct: levelPct,
    requiredN,
    currentN,
    sufficient: currentN >= requiredN,
    assumptionsFa,
  };
}

// ─────────────────────── سری زمانی/روند ───────────────────────

/** نقطه روند — برای نمودار تغییرات به ترتیب چرخه (B9). */
export interface TrendPoint {
  /** ترتیب مطلق مشاهده در کل مجموعه (۱-مبا) */
  index: number;
  cycleSeq: number;
  sessionId: string;
  value: number;
}

/** استخراج سری روند از مقادیر مرتب — قطعی. */
export function trendSeries(values: readonly number[], meta: ReadonlyArray<{ cycleSeq: number; sessionId: string }>): TrendPoint[] {
  const out: TrendPoint[] = [];
  values.forEach((v, i) => {
    const m = meta[i];
    if (Number.isFinite(v) && m) {
      out.push({ index: i + 1, cycleSeq: m.cycleSeq, sessionId: m.sessionId, value: v });
    }
  });
  return out;
}
