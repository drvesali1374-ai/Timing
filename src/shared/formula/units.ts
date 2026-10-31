/**
 * رجیستری واحدها و سازگاری ابعاد — فاز ۲ (بند B3 سند جامع: «تبدیل واحد» و
 * کشف «واحد ناسازگار»؛ FORMULA_CATALOG §۵٫۳ toUnit/duration).
 *
 * مدل: هر واحد یک «بُعد» (dimension) و ضریب نسبت به پایه بُعد دارد.
 *   - زمان: ms=0.001 · s=1 · min=60 · h=3600
 *   - طول: mm=0.001 · cm=0.01 · m=1 · km=1000
 *   - تعداد: pcs=1
 *   - بی‌بُعد: ''=1 · ratio=1 · percent=0.01
 * ابعاد مشتق (مثل s/pcs از تقسیم زمان بر تعداد) به‌صورت عبارت کانونی بُعد
 * نمایش و فقط در صورت یکسان‌بودن کامل قابل جمع/مقایسه‌اند.
 *
 * قاعده صداقت: درصد و نسبت هنگام محاسبات «بی‌تبدیل صریح» ناسازگار اعلام
 * می‌شوند (بدون تبدیل پنهان) — تبدیل صریح با toUnit(x, 'ratio') انجام می‌شود.
 */

export type Dimension =
  | "time"
  | "length"
  | "count"
  | "dimensionless"
  | string; // ابعاد مشتق مثل "time/count"

export interface UnitDef {
  /** نماد واحد مثل "s" */
  symbol: string;
  dimension: Dimension;
  /** ضریب نسبت به واحد پایه همان بُعد */
  factor: number;
  /** نام فارسی برای پیام‌ها */
  nameFa: string;
}

export const UNITS: Record<string, UnitDef> = {
  // ── زمان (پایه: ثانیه — FORMULA_CATALOG §۱: واحد پایه زمان ثانیه SI) ──
  ms: { symbol: "ms", dimension: "time", factor: 0.001, nameFa: "میلی‌ثانیه" },
  s: { symbol: "s", dimension: "time", factor: 1, nameFa: "ثانیه" },
  min: { symbol: "min", dimension: "time", factor: 60, nameFa: "دقیقه" },
  h: { symbol: "h", dimension: "time", factor: 3600, nameFa: "ساعت" },
  // ── طول (پایه: متر) ──
  mm: { symbol: "mm", dimension: "length", factor: 0.001, nameFa: "میلی‌متر" },
  cm: { symbol: "cm", dimension: "length", factor: 0.01, nameFa: "سانتی‌متر" },
  m: { symbol: "m", dimension: "length", factor: 1, nameFa: "متر" },
  km: { symbol: "km", dimension: "length", factor: 1000, nameFa: "کیلومتر" },
  // ── تعداد (پایه: عدد) ──
  pcs: { symbol: "pcs", dimension: "count", factor: 1, nameFa: "عدد" },
  // ── بی‌بُعد ──
  "": { symbol: "", dimension: "dimensionless", factor: 1, nameFa: "بدون واحد" },
  ratio: { symbol: "ratio", dimension: "dimensionless", factor: 1, nameFa: "نسبت" },
  /** درصد بُعد مستقل دارد تا ترکیب خام درصد با عدد بدون تبدیل صریح، خطای unit بگیرد */
  percent: { symbol: "percent", dimension: "percent", factor: 0.01, nameFa: "درصد" },
};

export class UnitError extends Error {
  constructor(messageFa: string) {
    super(messageFa);
    this.name = "UnitError";
  }
}

export function getUnit(symbol: string | undefined): UnitDef | null {
  if (symbol === undefined || symbol === null) return null;
  return UNITS[symbol] ?? null;
}

export function isKnownUnit(symbol: string): boolean {
  return symbol in UNITS;
}

/** خانواده ابعادی قابل‌تبدیل متقاطع (درصد ↔ بی‌بُعد) — تنها استثنای هم‌خانواده */
const DIMENSION_FAMILY: Record<string, string> = {
  percent: "scale",
  dimensionless: "scale",
};

/**
 * تبدیل صریح مقدار از واحد فعلی به واحد هدف.
 * خطا اگر بُعد متفاوت (و هم‌خانواده نباشد) یا واحد ناشناخته باشد.
 */
export function convertValue(value: number, fromSymbol: string | undefined, toSymbol: string): number {
  const from = getUnit(fromSymbol);
  const to = getUnit(toSymbol);
  if (!to) throw new UnitError(`واحد «${toSymbol}» در رجیستری ثبت نشده است.`);
  if (!from) {
    // مقدار بدون واحد: فقط در هدف بی‌بُعد معتبر است
    if (to.dimension !== "dimensionless") {
      throw new UnitError(`مقدار بدون واحد قابل تبدیل به «${to.nameFa}» نیست — از duration(x, 'واحد') برای برچسب‌گذاری استفاده کنید.`);
    }
    return value;
  }
  const convertible =
    from.dimension === to.dimension ||
    (DIMENSION_FAMILY[from.dimension] !== undefined && DIMENSION_FAMILY[from.dimension] === DIMENSION_FAMILY[to.dimension]);
  if (!convertible) {
    throw new UnitError(
      `تبدیل واحد ناسازگار: «${from.nameFa}» (بُعد ${from.dimension}) به «${to.nameFa}» (بُعد ${to.dimension}) مجاز نیست.`,
    );
  }
  // اگر نماد واحد/درصد متفاوت ولی هم‌بُعد: تبدیل ضریبی
  return (value * from.factor) / to.factor;
}

/** بُعد مشتقِ تقسیم دو بُعد (کانونیک: ساده‌سازی مکرر انجام نمی‌شود) */
export function divideDimensions(a: Dimension, b: Dimension): Dimension {
  if (b === "dimensionless") return a;
  if (a === "dimensionless") return `1/${b}`;
  return `${a}/${b}`;
}

export function multiplyDimensions(a: Dimension, b: Dimension): Dimension {
  if (a === "dimensionless") return b;
  if (b === "dimensionless") return a;
  return `${a}*${b}`;
}

/** آیا دو بُعد برای جمع/تفریق/مقایسه سازگارند؟ (بی‌بُعد با هر چیز نه — فقط هم‌بُعد) */
export function sameDimension(a: Dimension | undefined, b: Dimension | undefined): boolean {
  if (a === undefined || b === undefined) return true; // بدون واحد = بی‌توجهی به واحد (بدون خطا)
  return a === b;
}

/** نمایندگی واحد برای نمایش خروجی فرمول */
export function describeUnit(symbol: string | undefined): string | null {
  const u = getUnit(symbol);
  return u ? u.nameFa : null;
}
