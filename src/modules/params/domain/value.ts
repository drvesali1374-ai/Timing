/**
 * دامنه ماژول پارامترها — قواعد مقدار پارامتر (B2: جدایی تعریف از مقدار).
 */

import { ApiError } from "@/shared/errors";
import type { SnapshotParameterDef } from "@/shared/contracts/snapshot";

/** دامنه‌های مقدار — فاز ۲ فقط project؛ بقیه در فاز ۴+ فعال می‌شوند */
export const VALUE_SCOPES = ["project", "session", "cycle", "observation", "activity"] as const;
export type ValueScope = (typeof VALUE_SCOPES)[number];

export interface StoredParamValue {
  value: number | string | boolean | null | Array<number | string | boolean | null>;
  unit?: string;
}

/** اعتبارسنجی مقدار خام در برابر تعریف پارامتر — منبع واحد سرور و UI (از طریق API) */
export function validateValueAgainstDef(
  param: SnapshotParameterDef,
  raw: unknown,
): { ok: true; stored: StoredParamValue } | { ok: false; messageFa: string } {
  if (raw === null || raw === undefined || raw === "") {
    if (param.required) {
      return { ok: false, messageFa: `مقدار «${param.nameFa}» اجباری است.` };
    }
    return { ok: true, stored: { value: null } };
  }

  switch (param.dataType) {
    case "shortText":
    case "longText": {
      if (typeof raw !== "string") return { ok: false, messageFa: "مقدار متنی نیست." };
      if (param.dataType === "shortText" && raw.length > 300) {
        return { ok: false, messageFa: "متن کوتاه حداکثر ۳۰۰ نویسه است." };
      }
      return { ok: true, stored: { value: raw } };
    }
    case "integer":
    case "decimal":
    case "percent":
    case "ratio":
    case "duration":
    case "quantityWithUnit": {
      const num = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, "."));
      if (!Number.isFinite(num)) return { ok: false, messageFa: "مقدار عددی معتبر نیست." };
      if (param.dataType === "integer" && !Number.isInteger(num)) {
        return { ok: false, messageFa: "مقدار باید عدد صحیح باشد." };
      }
      if (param.min !== undefined && num < param.min) {
        return { ok: false, messageFa: `مقدار نباید کمتر از ${param.min} باشد.` };
      }
      if (param.max !== undefined && num > param.max) {
        return { ok: false, messageFa: `مقدار نباید بیشتر از ${param.max} باشد.` };
      }
      // دقت/گردکردن
      let value = num;
      if (param.precision !== undefined) {
        const factor = Math.pow(10, param.precision);
        switch (param.rounding ?? "round") {
          case "floor":
            value = Math.floor(num * factor) / factor;
            break;
          case "ceil":
            value = Math.ceil(num * factor) / factor;
            break;
          case "none":
            break;
          default:
            value = Math.round(num * factor) / factor;
        }
      }
      return { ok: true, stored: { value, ...(param.unit ? { unit: param.unit } : {}) } };
    }
    case "dateTime": {
      if (typeof raw !== "string") return { ok: false, messageFa: "مقدار تاریخ باید متن استاندارد باشد." };
      if (raw !== "today" && Number.isNaN(Date.parse(raw))) {
        return { ok: false, messageFa: "تاریخ معتبر نیست." };
      }
      return { ok: true, stored: { value: raw } };
    }
    case "boolean": {
      if (typeof raw === "boolean") return { ok: true, stored: { value: raw } };
      if (raw === "true") return { ok: true, stored: { value: true } };
      if (raw === "false") return { ok: true, stored: { value: false } };
      return { ok: false, messageFa: "مقدار بولی نیست." };
    }
    case "singleSelect": {
      if (typeof raw !== "string") return { ok: false, messageFa: "مقدار انتخاب تکی باید یک گزینه باشد." };
      if (!param.options?.some((o) => o.value === raw)) {
        return { ok: false, messageFa: "گزینه انتخاب‌شده در فهرست تعریف پارامتر نیست." };
      }
      return { ok: true, stored: { value: raw } };
    }
    case "multiSelect": {
      if (!Array.isArray(raw)) return { ok: false, messageFa: "مقدار انتخاب چندگانه باید فهرست باشد." };
      for (const item of raw) {
        if (!param.options?.some((o) => o.value === item)) {
          return { ok: false, messageFa: `گزینه «${String(item)}» در فهرست تعریف پارامتر نیست.` };
        }
      }
      return { ok: true, stored: { value: raw as string[] } };
    }
    case "entityRef": {
      if (typeof raw !== "string" || raw.length === 0) return { ok: false, messageFa: "ارجاع باید شناسه متنی باشد." };
      return { ok: true, stored: { value: raw } };
    }
    case "computed": {
      return { ok: false, messageFa: "پارامتر محاسباتی مقدار دستی نمی‌پذیرد — از ارزیابی فرمول استفاده کنید." };
    }
    default:
      return { ok: false, messageFa: "نوع داده پشتیبانی نمی‌شود." };
  }
}

/** مقدار پیش‌فرض برای پارامتر (با جایگزینی «today») */
export function defaultValueFor(param: SnapshotParameterDef, now = new Date()): StoredParamValue {
  if (param.defaultValue === undefined || param.defaultValue === null) return { value: null };
  if (param.defaultValue === "today") {
    return { value: now.toISOString().slice(0, 10) };
  }
  if (param.unit && typeof param.defaultValue === "number") {
    return { value: param.defaultValue, unit: param.unit };
  }
  return { value: param.defaultValue };
}

/** تبدیل مقدار ذخیره‌شده به ورودی موتور فرمول */
export function toFormulaInput(stored: StoredParamValue): { value: number | string | boolean | null | Array<number | string | boolean | null>; unit?: string } {
  if (stored.value === "today" && typeof stored.value === "string") {
    return { value: stored.value };
  }
  return { value: stored.value, ...(stored.unit !== undefined ? { unit: stored.unit } : {}) };
}

export function assertScopeType(scope: string): ValueScope {
  if (!(VALUE_SCOPES as readonly string[]).includes(scope)) {
    throw ApiError.badRequest("نوع دامنه مقدار نامعتبر است.");
  }
  return scope as ValueScope;
}
