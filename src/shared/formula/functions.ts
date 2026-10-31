/**
 * کتابخانه توابع بسته زبان عبارتی (DSL v1) — فهرست قطعی FORMULA_CATALOG §۵٫۳.
 *
 * «بسته» یعنی: هیچ تابع خارج این فهرست قابل فراخوانی نیست؛ پارسر نام تابع را
 * می‌پذارد اما تحلیل ایستا/ارزیابی فقط این امضاها را می‌شناسد.
 *
 * توابع آماری (sum/mean/median/stddev/count/quantile) روی آرایه‌های عددی
 * کار می‌کنند؛ ورودی آرایه از قرارداد ورودی فرمول یا داده نمونه می‌آید
 * (داده واقعی مشاهدات در فاز ۴/۵ به موتور وصل می‌شود).
 */

export type FuncArgType =
  | "number"
  | "string"
  | "boolean"
  | "any"
  | "numberArray"
  | "anyArray";

export interface FuncSignature {
  /** نام فراخوانی در DSL */
  name: string;
  /** کمینه/بیشینه تعداد آرگومان */
  minArgs: number;
  maxArgs: number;
  argTypes: FuncArgType[];
  /** نوع خروجی برای تحلیل ایستا */
  returnType: "number" | "string" | "boolean" | "any" | "numberArray";
  /** واحد خروجی اگر قابل تعیین است: 'same0' = واحد آرگومان اول عددی */
  outputUnitRule?: "same0";
  nameFa: string;
  descriptionFa: string;
}

export const FUNCTION_SIGNATURES: Record<string, FuncSignature> = {
  // ── ریاضی ──
  abs: {
    name: "abs", minArgs: 1, maxArgs: 1, argTypes: ["number"], returnType: "number", outputUnitRule: "same0",
    nameFa: "قدرمطلق", descriptionFa: "abs(x) — قدر مطلق عدد.",
  },
  min: {
    name: "min", minArgs: 1, maxArgs: 16, argTypes: ["number"], returnType: "number",
    nameFa: "کمینه", descriptionFa: "min(a, b, …) — کوچک‌ترین عدد.",
  },
  max: {
    name: "max", minArgs: 1, maxArgs: 16, argTypes: ["number"], returnType: "number",
    nameFa: "بیشینه", descriptionFa: "max(a, b, …) — بزرگ‌ترین عدد.",
  },
  round: {
    name: "round", minArgs: 1, maxArgs: 2, argTypes: ["number", "number"], returnType: "number", outputUnitRule: "same0",
    nameFa: "گردکردن", descriptionFa: "round(x, d) — گردکردن به d رقم اعشار (پیش‌فرض ۰).",
  },
  floor: {
    name: "floor", minArgs: 1, maxArgs: 1, argTypes: ["number"], returnType: "number", outputUnitRule: "same0",
    nameFa: "کف", descriptionFa: "floor(x) — بزرگ‌ترین عدد صحیح ≤ x.",
  },
  ceil: {
    name: "ceil", minArgs: 1, maxArgs: 1, argTypes: ["number"], returnType: "number", outputUnitRule: "same0",
    nameFa: "سقف", descriptionFa: "ceil(x) — کوچک‌ترین عدد صحیح ≥ x.",
  },
  sqrt: {
    name: "sqrt", minArgs: 1, maxArgs: 1, argTypes: ["number"], returnType: "number",
    nameFa: "جذر", descriptionFa: "sqrt(x) — جذر مربع (x≥۰).",
  },
  pow: {
    name: "pow", minArgs: 2, maxArgs: 2, argTypes: ["number", "number"], returnType: "number",
    nameFa: "توان", descriptionFa: "pow(x, y) — x به توان y.",
  },
  // ── آمار/تجمیع ──
  sum: {
    name: "sum", minArgs: 1, maxArgs: 1, argTypes: ["numberArray"], returnType: "number",
    nameFa: "مجموع", descriptionFa: "sum(arr) — مجموع آرایه اعداد.",
  },
  mean: {
    name: "mean", minArgs: 1, maxArgs: 1, argTypes: ["numberArray"], returnType: "number",
    nameFa: "میانگین", descriptionFa: "mean(arr) — میانگین حسابی (TS-001).",
  },
  median: {
    name: "median", minArgs: 1, maxArgs: 1, argTypes: ["numberArray"], returnType: "number",
    nameFa: "میانه", descriptionFa: "median(arr) — میانه مرتب‌شده (TS-002).",
  },
  stddev: {
    name: "stddev", minArgs: 1, maxArgs: 1, argTypes: ["numberArray"], returnType: "number",
    nameFa: "انحراف معیار نمونه", descriptionFa: "stddev(arr) — انحراف معیار نمونه با مخرج n−1 (ST-001).",
  },
  count: {
    name: "count", minArgs: 1, maxArgs: 1, argTypes: ["anyArray"], returnType: "number",
    nameFa: "تعداد", descriptionFa: "count(arr) — تعداد عناصر آرایه.",
  },
  quantile: {
    name: "quantile", minArgs: 2, maxArgs: 2, argTypes: ["numberArray", "number"], returnType: "number",
    nameFa: "چندک", descriptionFa: "quantile(arr, p) — چندک pام با درون‌یابی خطی (ST-004).",
  },
  // ── منطق/شرط ──
  if: {
    name: "if", minArgs: 3, maxArgs: 3, argTypes: ["boolean", "any", "any"], returnType: "any",
    nameFa: "شرط", descriptionFa: "if(cond, a, b) — اگر cond درست باشد a وگرنه b.",
  },
  and: {
    name: "and", minArgs: 2, maxArgs: 16, argTypes: ["boolean"], returnType: "boolean",
    nameFa: "و", descriptionFa: "and(a, b, …) — و منطقی.",
  },
  or: {
    name: "or", minArgs: 2, maxArgs: 16, argTypes: ["boolean"], returnType: "boolean",
    nameFa: "یا", descriptionFa: "or(a, b, …) — یا منطقی.",
  },
  not: {
    name: "not", minArgs: 1, maxArgs: 1, argTypes: ["boolean"], returnType: "boolean",
    nameFa: "نقیض", descriptionFa: "not(a) — نقیض منطقی.",
  },
  isMissing: {
    name: "isMissing", minArgs: 1, maxArgs: 1, argTypes: ["any"], returnType: "boolean",
    nameFa: "آیا ناموجود", descriptionFa: "isMissing(x) — آیا مقدار null/فاقد مقدار است.",
  },
  coalesce: {
    name: "coalesce", minArgs: 2, maxArgs: 16, argTypes: ["any"], returnType: "any",
    nameFa: "جایگزین ناموجود", descriptionFa: "coalesce(a, b, …) — نخستین مقدار موجود.",
  },
  // ── واحد ──
  toUnit: {
    name: "toUnit", minArgs: 2, maxArgs: 2, argTypes: ["number", "string"], returnType: "number",
    nameFa: "تبدیل واحد", descriptionFa: "toUnit(x, 'min') — تبدیل صریح عدد x به واحد هدف (هم‌بُعد).",
  },
  duration: {
    name: "duration", minArgs: 2, maxArgs: 2, argTypes: ["number", "string"], returnType: "number",
    nameFa: "مدت با واحد", descriptionFa: "duration(x, 's') — عدد x را با واحد زمانی هدف برچسب‌گذاری می‌کند (بدون تغییر مقدار پایه).",
  },
};

/** فهرست بسته نام توابع (برای تحلیل ایستا و UI) */
export const FUNCTION_NAMES = Object.keys(FUNCTION_SIGNATURES);

export function isKnownFunction(name: string): boolean {
  return name in FUNCTION_SIGNATURES;
}

export function getSignature(name: string): FuncSignature | null {
  return FUNCTION_SIGNATURES[name] ?? null;
}

/** توضیح فارسی فهرست توابع — برای راهنمای UI */
export function functionCatalogFa(): Array<{ name: string; nameFa: string; descriptionFa: string; signature: string }> {
  return FUNCTION_NAMES.map((name) => {
    const sig = FUNCTION_SIGNATURES[name];
    const args = sig.argTypes.slice(0, Math.max(sig.minArgs, 1)).map((t) => t).join(", ");
    const variadic = sig.maxArgs > sig.minArgs ? ", …" : "";
    return {
      name,
      nameFa: sig.nameFa,
      descriptionFa: sig.descriptionFa,
      signature: `${name}(${args}${variadic})`,
    };
  });
}
