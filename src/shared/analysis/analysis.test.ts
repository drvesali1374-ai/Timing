/**
 * آزمون‌های واحد هسته تحلیل (فاز ۵) — داده مرجع با «جواب مستقل» (R5-1).
 *
 * مقادیر مورد انتظار جدا از پیاده‌سازی TS و با محاسبه مستقل (Python/دستی)
 * محاسبه و در اینجا hard-code شده‌اند — معیار پذیرش فاز ۵: «نتایج با جواب مستقل
 * مقایسه شوند». tolerance 1e-9 برای اعداد اعشاری.
 *
 * پوشش:
 *  - آمار توصیفی (میانگین/میانه/کمینه/بیشینه/دامنه/انحراف n−1/CV/چندک نوع ۷)
 *  - مرزها: آرایه خالی / تک‌عضوی / دوعضوی
 *  - هیستوگرام (Sturges)
 *  - تشخیص پرت: IQR توکی در برابر z-score (تفاوت قواعد مستند)
 *  - فاصله اطمینان تقریب نرمال + کفایت نمونه ST-010
 *  - زنجیره زمان B4: نماینده/نرمال/استاندارد + دو قرارداد مجاز + داده ناقص
 *  - شمارش‌های شفافیت (حذف کاربر جدا از قاعده جدا از ناتمام)
 */

import { describe, expect, test } from "bun:test";
import {
  coefficientOfVariation,
  confidenceIntervalMean,
  descriptiveStats,
  detectOutliers,
  histogram,
  max,
  mean,
  median,
  min,
  quantile,
  q1,
  q3,
  rangeOf,
  requiredSampleSize,
  sampleStddev,
  sum,
} from "./stats";
import { computeTimeChain } from "./timechain";
import type { AnalysisSettings, MarkedObservation } from "./types";

const EPS = 1e-9;

// ─────────────────────── داده مرجع ۱: [10, 12, 14, 16, 18] ───────────────────────
// جواب مستقل (محاسبه دستی/Python):
//  mean=14 · median=14 · min=10 · max=18 · range=8
//  s=√(40/4)=√10=3.1622776601683795 · CV=0.22587697572631282
//  Q1=12 (h=1) · Q3=16 (h=3) — نوع ۷

describe("آمار توصیفی — داده مرجع ۱", () => {
  const d1 = [10, 12, 14, 16, 18];
  test("جمع/میانگین/میانه", () => {
    expect(sum(d1)).toBe(70);
    expect(mean(d1)).toBe(14);
    expect(median(d1)).toBe(14);
  });
  test("کمینه/بیشینه/دامنه", () => {
    expect(min(d1)).toBe(10);
    expect(max(d1)).toBe(18);
    expect(rangeOf(d1)).toBe(8);
  });
  test("انحراف معیار نمونه n−1 (تصحیح بسل)", () => {
    expect(sampleStddev(d1)!).toBeCloseTo(3.1622776601683795, 9);
  });
  test("ضریب تغییرات", () => {
    expect(coefficientOfVariation(d1)!).toBeCloseTo(0.22587697572631282, 9);
  });
  test("چندک نوع ۷ — Q1/Q3", () => {
    expect(q1(d1)).toBe(12);
    expect(q3(d1)).toBe(16);
    expect(quantile(d1, 0)).toBe(10);
    expect(quantile(d1, 1)).toBe(18);
    expect(quantile(d1, 0.5)).toBe(14);
  });
  test("descriptiveStats یک‌جا", () => {
    const st = descriptiveStats(d1);
    expect(st.n).toBe(5);
    expect(st.mean).toBe(14);
    expect(st.median).toBe(14);
    expect(st.stddev!).toBeCloseTo(3.1622776601683795, 9);
    expect(st.cv!).toBeCloseTo(0.22587697572631282, 9);
    expect(st.q1).toBe(12);
    expect(st.q3).toBe(16);
  });
});

// ─────────────────────── مرزها ───────────────────────

describe("مرزها — خالی/تک/دو", () => {
  test("آرایه خالی: همه null (ادعای عدد نمی‌شود)", () => {
    expect(mean([])).toBeNull();
    expect(median([])).toBeNull();
    expect(min([])).toBeNull();
    expect(max([])).toBeNull();
    expect(sampleStddev([])).toBeNull();
    expect(q1([])).toBeNull();
    expect(histogram([])).toBeNull();
  });
  test("تک‌عضوی: میانگین/میانه مقدار؛ انحراف null (n−1 تعریف‌نشده)", () => {
    expect(mean([5])).toBe(5);
    expect(median([5])).toBe(5);
    expect(sampleStddev([5])).toBeNull();
    expect(coefficientOfVariation([5])).toBeNull();
    expect(q1([5])).toBe(5);
    expect(histogram([5])).toBeNull();
  });
  test("دوعضوی [3,7]: s=√8 · CV=√8/5", () => {
    expect(mean([3, 7])).toBe(5);
    expect(median([3, 7])).toBe(5);
    expect(sampleStddev([3, 7])!).toBeCloseTo(2.8284271247461903, 9);
    expect(coefficientOfVariation([3, 7])!).toBeCloseTo(0.565685424949238, 9);
    expect(quantile([3, 7], 0.25)).toBe(4); // h=0.25 → 3×0.75+7×0.25
  });
  test("میانگین صفر → CV null (تقسیم بر صفر ادعا نمی‌شود)", () => {
    expect(coefficientOfVariation([-2, 2])).toBeNull();
  });
});

// ─────────────────────── داده مرجع ۲ (با پرت): [10, 11, 12, 12, 13, 40] ───────────────────────
// جواب مستقل: mean=16.333333333333332 · median=12 · s=11.63901484949077
//  Q1=11.25 · Q3=12.75 · IQR=1.5 · حصار k=۱٫۵: [9, 15] → 40 بیرون
//  z(40)=2.0333908816777675 → قاعده z>۳ آن را پرت نمی‌داند (تفاوت قواعد!)

describe("تشخیص پرت — دو قاعده، دو جواب مستند", () => {
  const d2 = [10, 11, 12, 12, 13, 40];
  test("میانگین/انحراف مرجع", () => {
    expect(mean(d2)!).toBeCloseTo(16.333333333333332, 9);
    expect(median(d2)).toBe(12);
    expect(sampleStddev(d2)!).toBeCloseTo(11.63901484949077, 9);
  });
  test("IQR توکی: 40 مشکوک شناخته می‌شود (بیرون از [9,15])", () => {
    const det = detectOutliers(d2, "iqr-1.5")!;
    expect(det.suspectIndices).toEqual([5]);
    expect(det.boundsFa).toContain("9.000");
  });
  test("z-score سه‌سیگمایی: 40 مشکوک نیست (z≈2.03) — قواعد یکی نیستند", () => {
    const det = detectOutliers(d2, "z-3")!;
    expect(det.suspectIndices).toEqual([]);
  });
  test("n<۴ → بدون حصار معتبر IQR (null)", () => {
    expect(detectOutliers([1, 2, 3], "iqr-1.5")).toBeNull();
  });
});

// ─────────────────────── هیستوگرام ───────────────────────

describe("هیستوگرام — Sturges", () => {
  test("n=5 → k=⌈1+log₂5⌉=4 بازه؛ جمع شمارش‌ها = n", () => {
    const h = histogram([10, 12, 14, 16, 18])!;
    expect(h.bins.length).toBe(4);
    expect(h.bins.reduce((a, b) => a + b.count, 0)).toBe(5);
    expect(h.binWidth).toBeCloseTo(2, 9); // (18-10)/4
  });
  test("همه برابر → بازه واحد", () => {
    const h = histogram([7, 7, 7])!;
    expect(h.bins.length).toBe(1);
    expect(h.bins[0].count).toBe(3);
  });
});

// ─────────────────────── فاصله اطمینان + کفایت ───────────────────────
// جواب مستقل d1 (95%): half=2.7718585822512662 · low=11.228141417748734 · high=16.771858582251266
// کفایت: n_req=(1.96×0.22587697572631282/0.05)²=78.4…→79 · در 90%: 56

describe("استنباط — فاصله اطمینان و کفایت نمونه", () => {
  const d1 = [10, 12, 14, 16, 18];
  test("CI ۹۵٪ تقریب نرمال مطابق جواب مستقل", () => {
    const ci = confidenceIntervalMean(d1, 95)!;
    expect(ci.z).toBe(1.96);
    expect(ci.halfWidth!).toBeCloseTo(2.7718585822512662, 9);
    expect(ci.low!).toBeCloseTo(11.228141417748734, 9);
    expect(ci.high!).toBeCloseTo(16.771858582251266, 9);
    expect(ci.assumptionsFa.length).toBeGreaterThan(0); // فرض‌ها صریح
  });
  test("سطح ناشناخته → null", () => {
    expect(confidenceIntervalMean(d1, 80)).toBeNull();
  });
  test("n=1 → بدون فاصله (پراکندگی نامعین) + هشدار", () => {
    const ci = confidenceIntervalMean([5], 95)!;
    expect(ci.halfWidth).toBeNull();
    expect(ci.assumptionsFa[0]).toContain("n<۲");
  });
  test("کفایت ۹۵٪/۵٪ → 79 (جواب مستقل)؛ 90٪ → 56", () => {
    const cv = coefficientOfVariation(d1);
    const a95 = requiredSampleSize(cv, 5, 95, 5)!;
    expect(a95.requiredN).toBe(79);
    expect(a95.sufficient).toBe(false); // 5 < 79
    const a90 = requiredSampleSize(cv, 5, 90, 5)!;
    expect(a90.requiredN).toBe(56);
  });
  test("CV نامعین → requiredN null و sufficient null (صادقانه)", () => {
    const a = requiredSampleSize(null, 5, 95, 1)!;
    expect(a.requiredN).toBeNull();
    expect(a.sufficient).toBeNull();
  });
});

// ─────────────────────── زنجیره زمان B4 ───────────────────────

/** مشاهده ساختگی کمکی — با هویت ردیابی. */
function obs(durationMs: number, over?: Partial<MarkedObservation>): MarkedObservation {
  return {
    sessionId: "s-test",
    sessionMethod: "continuous",
    observer: "ناظر آزمون",
    cycleSeq: 1,
    cycleStatus: "valid",
    elementKey: "el.x",
    elementName: "عنصر آزمون",
    durationMs,
    readingEventId: `r-${Math.random().toString(36).slice(2)}`,
    corrected: false,
    flags: [],
    sessionContext: {},
    mark: null,
    ...over,
  };
}

const SETTINGS: AnalysisSettings = {
  aggMethod: "mean",
  outlierRule: "iqr-1.5",
  ratingEnabled: true,
  ratingFactorPct: 110,
  allowanceMethod: "on-normal",
  allowanceRatePct: 15,
  confidencePct: 95,
  targetPrecisionPct: 5,
};

describe("زنجیره زمان — داده مرجع [1000..1400]ms", () => {
  const observations = [1000, 1100, 1200, 1300, 1400].map((d, i) =>
    obs(d, { cycleSeq: i + 1, readingEventId: `r-${i}` }),
  );
  // جواب مستقل: rep=1200 · NT=1200×1.1=1320 · ST(on-normal)=1320×1.15=1518
  test("میانگین → نرمال ۱۱۰٪ → استاندارد on-normal ۱۵٪ = 1518ms", () => {
    const chain = computeTimeChain(observations, SETTINGS);
    expect(chain.representative.status).toBe("valid");
    expect(chain.representative.value).toBe(1200);
    expect(chain.representative.effectiveN).toBe(5);
    expect(chain.normal.value).toBeCloseTo(1320, 6);
    expect(chain.standard.status).toBe("valid");
    expect(chain.standard.value!).toBeCloseTo(1518, 6);
    expect(chain.standard.baseFa).toContain("زمان نرمال");
  });
  // جواب مستقل: ST(on-standard)=1320/0.85=1552.9411764705883
  test("قرارداد on-standard: 1320÷0.85=1552.941… — نابرابر on-normal", () => {
    const chain = computeTimeChain(observations, { ...SETTINGS, allowanceMethod: "on-standard" });
    expect(chain.standard.value!).toBeCloseTo(1552.9411764705883, 9);
    expect(chain.standard.value!).not.toBeCloseTo(1518, 9);
    expect(chain.standard.baseFa).toContain("زمان استاندارد");
  });
  test("میانه: [1000..1400] → 1200؛ زوج → میانگین دو میانی", () => {
    const chain = computeTimeChain(observations, { ...SETTINGS, aggMethod: "median" });
    expect(chain.representative.value).toBe(1200);
    const even = computeTimeChain(
      [1000, 1100, 1200, 1300].map((d, i) => obs(d, { cycleSeq: i + 1 })),
      { ...SETTINGS, aggMethod: "median" },
    );
    expect(even.representative.value).toBe(1150); // (1100+1200)/2
  });
  // جواب مستقل: حذف 1400 → rep=1150 · NT=1265 · ST=1454.75
  test("حذف یک مشاهده (علامت کاربر) → اثر روشن: rep=1150, ST=1454.75", () => {
    const withExclusion = observations.map((o, i) =>
      i === 4 ? { ...o, mark: { outlierMarked: true, excluded: true, reason: "آزمون", markedBy: "u", markedAt: "t" } } : o,
    );
    const chain = computeTimeChain(withExclusion, SETTINGS);
    expect(chain.counts.userExcluded).toBe(1);
    expect(chain.counts.usable).toBe(4);
    expect(chain.representative.value).toBe(1150);
    expect(chain.normal.value).toBeCloseTo(1265, 6);
    expect(chain.standard.value!).toBeCloseTo(1454.75, 6);
  });
  test("علامت پرت بدون حذف → تأثیری بر محاسبه ندارد (دو عمل جدا)", () => {
    const markedOnly = observations.map((o, i) =>
      i === 4 ? { ...o, mark: { outlierMarked: true, excluded: false, reason: null, markedBy: "u", markedAt: "t" } } : o,
    );
    const chain = computeTimeChain(markedOnly, SETTINGS);
    expect(chain.counts.userExcluded).toBe(0);
    expect(chain.representative.value).toBe(1200); // بدون تغییر
  });
});

describe("زنجیره زمان — قاعده پرت در تجمیع (agg=outlierRule)", () => {
  // [1000,1050,1100,1150,3000]: حصار توکی [900,1300] → 3000 مشکوک؛ rep پس از قاعده = 1075
  const observations = [1000, 1050, 1100, 1150, 3000].map((d, i) =>
    obs(d, { cycleSeq: i + 1, readingEventId: `r-${i}` }),
  );
  test("حذف قاعده‌ای پرت سپس میانگین → 1075ms با هشدار مستند", () => {
    const chain = computeTimeChain(observations, { ...SETTINGS, aggMethod: "outlierRule" });
    expect(chain.counts.ruleSuspect).toBe(1);
    expect(chain.representative.effectiveN).toBe(4);
    expect(chain.representative.value).toBe(1075);
    expect(chain.representative.warningsFa.join(" ")).toContain("کنار گذاشته شد");
  });
  test("همان داده با agg=mean → پرت در محاسبه می‌ماند (mean=1460)", () => {
    const chain = computeTimeChain(observations, SETTINGS);
    expect(chain.representative.value).toBe(1460);
  });
});

describe("زنجیره زمان — داده ناقص و صداقت", () => {
  test("بدون مشاهده → همه گام‌ها incomplete بدون عدد جعلی", () => {
    const chain = computeTimeChain([], SETTINGS);
    expect(chain.representative.status).toBe("incomplete");
    expect(chain.representative.value).toBeNull();
    expect(chain.normal.status).toBe("incomplete");
    expect(chain.standard.status).toBe("incomplete");
  });
  test("چرخه ناتمام → شمارش جدا؛ وارد محاسبه نمی‌شود", () => {
    const observations = [obs(1000, { cycleStatus: "incomplete" }), obs(1100, { cycleSeq: 2 })];
    const chain = computeTimeChain(observations, SETTINGS);
    expect(chain.counts.incompleteCycle).toBe(1);
    expect(chain.counts.usable).toBe(1);
    expect(chain.representative.value).toBe(1100);
    expect(chain.representative.warningsFa.join(" ")).toContain("تک‌مشاهده");
  });
  test("ارزیابی غیرفعال → «زمان خام» incomplete — نه زمان نرمال قطعی", () => {
    const observations = [obs(1000), obs(1200)];
    const chain = computeTimeChain(observations, { ...SETTINGS, ratingEnabled: false });
    expect(chain.normal.status).toBe("incomplete");
    expect(chain.normal.value).toBe(1100); // همان خام
    expect(chain.normal.labelFa).toContain("زمان خام");
    expect(chain.normal.warningsFa.join(" ")).toContain("B4");
    expect(chain.standard.status).toBe("incomplete"); // وابسته به نرمال
  });
  test("on-standard با r≥۱۰۰٪ → invalid (مخرج صفر)", () => {
    const observations = [obs(1000), obs(1200)];
    const chain = computeTimeChain(observations, { ...SETTINGS, allowanceMethod: "on-standard", allowanceRatePct: 100 });
    expect(chain.standard.status).toBe("invalid");
    expect(chain.standard.value).toBeNull();
  });
});

describe("شمارش‌های شفافیت", () => {
  test("تفکیک کامل: کل/قابل‌استفاده/حذف کاربر/ناتمام/مشکوک قاعده/پرچم/اصلاح", () => {
    const observations: MarkedObservation[] = [
      obs(1000, { cycleSeq: 1, flags: ["visibilityLoss"] }),
      obs(1100, { cycleSeq: 2, corrected: true }),
      obs(1200, { cycleSeq: 3, cycleStatus: "incomplete" }),
      obs(1300, {
        cycleSeq: 4,
        mark: { outlierMarked: true, excluded: true, reason: "وقفه ثبت‌نشده", markedBy: "u", markedAt: "t" },
      }),
      obs(1400, { cycleSeq: 5 }),
    ];
    const chain = computeTimeChain(observations, SETTINGS);
    expect(chain.counts.total).toBe(5);
    expect(chain.counts.usable).toBe(3);
    expect(chain.counts.userExcluded).toBe(1);
    expect(chain.counts.incompleteCycle).toBe(1);
    expect(chain.counts.flagged).toBe(1);
    expect(chain.counts.corrected).toBe(1);
    expect(chain.counts.effective).toBe(3); // agg=mean → بدون حذف قاعده
    expect(chain.representative.value).toBeCloseTo((1000 + 1100 + 1400) / 3, 6);
  });
});
