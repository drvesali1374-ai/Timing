/**
 * دامنه ماژول مطالعه دستی — برگه ثبت زمان (ADR-017).
 * ----------------------------------------------------------------
 * پارادایم: کاربر زمان‌ها را با کرنومتر واقعی/ابزار مستقل اندازه گرفته و
 * اعداد را در جدول ثبت می‌کند. هیچ رویداد ساختگی کرنومتری تولید نمی‌شود.
 * کاتالوگ‌ها و وضعیت‌ها در shared/contracts/manual-study تعریف شده‌اند (قرارداد مشترک).
 */

import { ApiError } from "@/shared/errors";
import {
  INTERRUPTION_REASONS,
  MANUAL_SHEET_STATUSES,
  MAX_SAMPLES,
  type InterruptionReason,
  type ManualSheetStatus,
  type ObservationSource,
} from "@/shared/contracts/manual-study";

export {
  INTERRUPTION_REASONS,
  INTERRUPTION_REASON_LABELS_FA,
  MANUAL_SHEET_STATUSES,
  MANUAL_SHEET_STATUS_LABELS_FA,
  OBSERVATION_SOURCES,
  MAX_SAMPLES,
} from "@/shared/contracts/manual-study";
export type { InterruptionReason, ManualSheetStatus, ObservationSource } from "@/shared/contracts/manual-study";

export const MAX_SHEET_ACTIVITIES = 200;

export function isManualSheetStatus(v: string): v is ManualSheetStatus {
  return (MANUAL_SHEET_STATUSES as readonly string[]).includes(v);
}

export function isInterruptionReason(v: string): v is InterruptionReason {
  return (INTERRUPTION_REASONS as readonly string[]).includes(v);
}

export function isObservationSource(v: string): v is ObservationSource {
  return (["manual", "paste", "import"] as const).includes(v as "manual");
}

/** اعتبارسنجی علت وقفه — «سایر» بدون متن دلخواه نامعتبر است (الزام دستورالعمل ۵٫۵). */
export function validateInterruptionReason(
  reason: string,
  reasonOther: string | null | undefined,
): { ok: true; reason: InterruptionReason; reasonOther: string | null } | { ok: false; messageFa: string } {
  if (!isInterruptionReason(reason)) {
    return { ok: false, messageFa: "علت وقفه از فهرست معتبر انتخاب نشده است." };
  }
  if (reason === "other") {
    const text = (reasonOther ?? "").trim();
    if (!text) {
      return { ok: false, messageFa: "با انتخاب «سایر»، نوشتن علت وقفه الزامی است." };
    }
    return { ok: true, reason, reasonOther: text };
  }
  return { ok: true, reason, reasonOther: null };
}

/** قیود ابعاد جدول */
export function assertSampleIndex(sampleIndex: number): number {
  if (!Number.isInteger(sampleIndex) || sampleIndex < 1 || sampleIndex > MAX_SAMPLES) {
    throw ApiError.badRequest(`شماره نمونه باید عدد صحیح بین ۱ تا ${MAX_SAMPLES} باشد.`);
  }
  return sampleIndex;
}
