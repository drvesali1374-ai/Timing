/**
 * دامنه ماژول فعالیت‌ها — مدل مشترک B5 (مصرف‌کننده: نمودار فاز ۳، کرنومتر فاز ۴، بالانس فاز ۶).
 */

import { ApiError } from "@/shared/errors";

export const WORK_TYPE_LABELS_FA: Record<string, string> = {
  operatorManual: "دستی اپراتور",
  machineAuto: "خودکار ماشین",
  waiting: "انتظار/تأخیر",
  transport: "حرکت/جابه‌جایی",
  inspection: "بازرسی",
  setupChangeover: "راه‌اندازی/تعویض",
  overlap: "هم‌پوشان",
};

export const VA_CLASSIFICATION_LABELS_FA: Record<string, string> = {
  valueAdded: "ارزش‌افزا",
  nonValueAdded: "غیرارزش‌افزا",
  essentialNonVA: "غیرارزش‌افزای ضروری",
};

export const SOURCE_OF_TIME_LABELS_FA: Record<string, string> = {
  measured: "اندازه‌گیری‌شده",
  estimated: "برآوردی",
  referenced: "ارجاعی",
};

export const ACTIVITY_STABLE_KEY_RE = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;

export function isWorkType(v: unknown): v is string {
  return typeof v === "string" && v in WORK_TYPE_LABELS_FA;
}

export function isVaClassification(v: unknown): v is string {
  return typeof v === "string" && v in VA_CLASSIFICATION_LABELS_FA;
}

export function isSourceOfTime(v: unknown): v is string {
  return typeof v === "string" && v in SOURCE_OF_TIME_LABELS_FA;
}

export function assertWorkType(v: unknown): string {
  if (!isWorkType(v)) {
    throw ApiError.badRequest("نوع کار نامعتبر است (B5).");
  }
  return v;
}

export function assertActivityStableKey(v: unknown): string {
  if (typeof v !== "string" || !ACTIVITY_STABLE_KEY_RE.test(v)) {
    throw ApiError.badRequest("شناسه فنی فعالیت باید حروف کوچک لاتین با خط تیره/نقطه باشد (مثل el.install-door).");
  }
  return v;
}
