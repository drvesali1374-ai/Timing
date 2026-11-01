/**
 * دامنه ماژول تحلیل — اعتبارسنجی zod + برچسب‌ها (فاز ۵).
 * هسته محاسباتی در shared/analysis (خالص)؛ اینجا قراردادهای HTTP اعتبارسنجی می‌شوند.
 * علامت‌گذاری پرت و حذف از محاسبه دو عمل جدا هستند — در اسکیما هم جدا اعتبارسنجی می‌شوند.
 */

import { z } from "zod";
import { OUTLIER_RULES, ALLOWANCE_METHODS, AGGREGATION_METHODS, CONFIDENCE_LEVELS } from "@/shared/analysis/types";
import { REPORT_TEMPLATES, EXPORT_FORMATS } from "@/shared/contracts/analysis";
import type { ReportTemplate, ExportFormat } from "@/shared/contracts/analysis";

// ─────────────────────── علامت مشاهده ───────────────────────

/**
 * علامت/حذف مشاهده.
 * قاعده صداقت (B9): excluded=true بدون reason رد می‌شود — حذف بی‌علت نامعتبر است.
 * هر فراخوانی «حالت هدف» را اعلام می‌کند؛ تاریخچه append-only در repo نگه داشته می‌شود.
 */
export const markObservationSchema = z
  .object({
    sessionId: z.string().min(8).max(64),
    readingEventId: z.string().min(8).max(64),
    cycleSeq: z.number().int().min(1),
    elementKey: z.string().min(1).max(80),
    /** عمل ۱: علامت «داده پرت/مشکوک» (بدون حذف) */
    outlierMarked: z.boolean(),
    /** عمل ۲: حذف از محاسبه — جدا از علامت */
    excluded: z.boolean(),
    /** علت — برای حذف الزامی؛ برای علامت اختیاری اما توصیه‌شده */
    reason: z.string().max(500).optional().nullable(),
  })
  .refine((v) => !(v.excluded && !v.reason?.trim()), {
    message: "حذف مشاهده از محاسبه بدون ثبت علت مجاز نیست (B9: حذف باید علت داشته باشد).",
    path: ["reason"],
  })
  .refine((v) => !(v.outlierMarked === false && v.excluded === false && v.reason?.trim()), {
    message: "علت برای «برداشتن هر دو علامت» لازم نیست — مقدار reason را حذف کنید.",
    path: ["reason"],
  });
export type MarkObservationInput = z.infer<typeof markObservationSchema>;

// ─────────────────────── زمینه جلسه (پارامترهای سفارشی scopeType=session) ───────────────────────

/** ثبت زمینه جلسه — فیلتر/تفکیک تحلیل بر پارامترهای سفارشی (بند ۶ فاز ۵). */
export const sessionContextSchema = z.object({
  sessionId: z.string().min(8).max(64),
  values: z
    .array(
      z.object({
        stableKey: z.string().min(1).max(120),
        value: z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
      }),
    )
    .min(1, "حداقل یک مقدار زمینه لازم است")
    .max(30),
});
export type SessionContextInput = z.infer<typeof sessionContextSchema>;

// ─────────────────────── تنظیمات تحلیل (پارامترهای project-scope موجود) ───────────────────────

export const analysisSettingsSchema = z.object({
  aggMethod: z.enum(AGGREGATION_METHODS as unknown as [string, ...string[]]),
  outlierRule: z.enum(OUTLIER_RULES as unknown as [string, ...string[]]),
  ratingEnabled: z.boolean(),
  ratingFactorPct: z.number().min(50).max(150),
  allowanceMethod: z.enum(ALLOWANCE_METHODS as unknown as [string, ...string[]]),
  allowanceRatePct: z.number().min(0).max(90),
  confidencePct: z.union([z.literal(90), z.literal(95), z.literal(99)]),
  targetPrecisionPct: z.number().min(1).max(50),
});
export type AnalysisSettingsInput = z.infer<typeof analysisSettingsSchema>;

// ─────────────────────── خروجی گزارش ───────────────────────

export const exportQuerySchema = z.object({
  template: z.enum(REPORT_TEMPLATES as unknown as [string, ...string[]]),
  format: z.enum(EXPORT_FORMATS as unknown as [string, ...string[]]),
});

export type { ReportTemplate, ExportFormat };
