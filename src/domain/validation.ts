// ═══════════════════════════════════════════════════════════
// اعتبارسنجی سمت سرور — Zod — ۶.۸
// تمام ورودی‌ها سمت سرور اعتبارسنجی می‌شوند؛
// اعتبارسنجی Frontend به‌تنهایی کافی نیست.
// اعداد فارسی/عربی پیش از اعتبارسنجی نرمال می‌شوند (FR-07).
// ═══════════════════════════════════════════════════════════
import { z } from 'zod'
import { parseNumber } from '@/lib/persian'
import {
  PROCESS_TYPES,
  ELEMENT_TYPES,
  PROJECT_STATUSES,
  ALLOWANCE_METHODS,
  AGGREGATION_METHODS,
  RATING_FACTORS,
} from './types'

/** پیش‌پردازنده عدد: رشته فارسی/عربی → number (نامعتبر → undefined برای فیلد اختیاری) */
const numberFromString = (opts?: { min?: number; max?: number }) =>
  z.preprocess((v) => {
    if (v === null || v === undefined || v === '') return undefined
    const n = parseNumber(v as string | number)
    if (Number.isNaN(n)) return Number.NaN // باعث خطای invalid_type می‌شود
    return n
  }, z.number({ message: 'مقدار عددی معتبر وارد کنید (ارقام فارسی یا لاتین)' }).refine(
    (n) => Number.isFinite(n),
    { message: 'مقدار عددی معتبر وارد کنید' }
  ).refine((n) => opts?.min === undefined || n >= opts.min, {
    message: `مقدار باید بزرگ‌تر یا مساوی ${opts?.min} باشد`,
  }).refine((n) => opts?.max === undefined || n <= opts.max, {
    message: `مقدار باید کوچک‌تر یا مساوی ${opts?.max} باشد`,
  }))

const optionalNumber = (opts?: { min?: number; max?: number }) =>
  z.preprocess((v) => {
    if (v === null || v === undefined || v === '') return null
    const n = parseNumber(v as string | number)
    return Number.isNaN(n) ? Number.NaN : n
  }, z.number().refine((n) => Number.isFinite(n), { message: 'مقدار عددی معتبر وارد کنید' })
    .refine((n) => opts?.min === undefined || n >= opts.min, { message: `مقدار باید ≥ ${opts?.min} باشد` })
    .refine((n) => opts?.max === undefined || n <= opts.max, { message: `مقدار باید ≤ ${opts?.max} باشد` })
    .nullable())

const trimmed = (max: number, min = 1) => z.string().trim().min(min, 'این فیلد الزامی است').max(max, `حداکثر ${max} نویسه`)

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// ── پروژه — FR-01 ──
export const projectCreateSchema = z.object({
  name: trimmed(200),
  lineName: trimmed(200),
  productName: trimmed(200),
  studyDate: z.string().regex(ISO_DATE, 'تاریخ مطالعه معتبر نیست').nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
})

export const projectUpdateSchema = z.object({
  name: trimmed(200).optional(),
  lineName: trimmed(200).optional(),
  productName: trimmed(200).optional(),
  studyDate: z.string().regex(ISO_DATE, 'تاریخ مطالعه معتبر نیست').nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  expectedUpdatedAt: z.string().datetime().optional(), // کنترل هم‌زمانی — ۶.۶
})

// ── کپی پروژه — FR-01 ──
export const projectDuplicateSchema = z.object({
  newProjectName: trimmed(200),
  include: z.object({
    structure: z.boolean().default(true), // ایستگاه‌ها/فعالیت‌ها/عناصر (پیش‌فرض)
    settings: z.boolean().default(true),
    operators: z.boolean().default(false),
    groupsAndAllowances: z.boolean().default(false),
    ratingTables: z.boolean().default(false),
    rawObservations: z.boolean().default(false), // صرفاً با انتخاب صریح کاربر
  }),
})

// ── ایستگاه / فعالیت / عنصر — FR-02 ──
export const stationCreateSchema = z.object({
  name: trimmed(200),
  description: z.string().trim().max(3000).nullable().optional(),
})

export const stationUpdateSchema = stationCreateSchema.partial().extend({
  expectedUpdatedAt: z.string().datetime().optional(),
})

export const activityCreateSchema = z.object({
  name: trimmed(200),
  description: z.string().trim().max(3000).nullable().optional(),
  processType: z.enum(PROCESS_TYPES).default('OPERATION'),
  groupId: z.string().uuid('گروه انتخاب‌شده معتبر نیست').nullable().optional(),
  targetSampleCount: optionalNumber({ min: 1, max: 10000 }),
})

export const activityUpdateSchema = activityCreateSchema.partial().extend({
  expectedUpdatedAt: z.string().datetime().optional(),
})

export const elementCreateSchema = z.object({
  name: trimmed(300),
  description: z.string().trim().max(3000).nullable().optional(),
  elementType: z.enum(ELEMENT_TYPES).default('MANUAL'),
})

export const elementUpdateSchema = elementCreateSchema.partial().extend({
  expectedUpdatedAt: z.string().datetime().optional(),
})

export const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'فهرست ترتیب خالی است'),
})

// ── اپراتور — FR-05 ──
export const operatorCreateSchema = z.object({
  displayName: trimmed(200),
  code: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export const operatorUpdateSchema = operatorCreateSchema.partial().extend({
  expectedUpdatedAt: z.string().datetime().optional(),
})

// ── گروه‌ها و مجازها — FR-04 ──
export const groupCreateSchema = z.object({
  name: trimmed(200),
  description: z.string().trim().max(2000).nullable().optional(),
})

export const groupUpdateSchema = groupCreateSchema.partial().extend({
  expectedUpdatedAt: z.string().datetime().optional(),
})

export const categoryCreateSchema = z.object({
  name: trimmed(200),
  code: z.string().trim().max(50).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: numberFromString({ min: 0, max: 9999 }).default(0),
})

export const categoryUpdateSchema = categoryCreateSchema.partial().extend({
  expectedUpdatedAt: z.string().datetime().optional(),
})

// درصد مجاز: مقدار اعشاری محاسباتی — ۱۵٪ = 0.15 — FR-15
export const percentValueSchema = numberFromString({ min: 0, max: 0.9999 }).refine(
  (n) => n >= 0 && n < 1,
  { message: 'درصد مجاز باید بین ۰ و کمتر از ۱۰۰ باشد' }
)

export const groupAllowancesPutSchema = z.object({
  values: z.array(
    z.object({
      categoryId: z.string().uuid(),
      percentValue: percentValueSchema.nullable(), // null = بدون مقدار
    })
  ).min(1),
})

export const activityAllowancesPutSchema = z.object({
  overrides: z.array(
    z.object({
      categoryId: z.string().uuid(),
      percentValue: percentValueSchema.nullable(), // null = حذف بازنویسی و بازگشت به ارث‌بری
    })
  ).min(1),
  expectedUpdatedAt: z.string().datetime().optional(),
})

// ── وستینگهاوس — FR-13 ──
export const gradeSchema = z.object({
  factor: z.enum(RATING_FACTORS),
  gradeCode: z.string().trim().min(1).max(10),
  label: z.string().trim().min(1).max(100),
  value: numberFromString({ min: -0.5, max: 0.5 }),
  hint: z.string().trim().max(1000).nullable().optional(),
  sortOrder: numberFromString({ min: 0, max: 999 }).default(0),
})

export const ratingTableCreateSchema = z.object({
  name: trimmed(200),
  source: z.string().trim().max(1000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  baseOnTableId: z.string().uuid().nullable().optional(), // نسخه جدید بر اساس جدول موجود
  grades: z.array(gradeSchema).min(4, 'جدول حداقل باید برای هر عامل یک درجه داشته باشد'),
  makeDefault: z.boolean().default(true),
})

export const ratingTableUpdateSchema = z.object({
  name: trimmed(200).optional(),
  source: z.string().trim().max(1000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  isDefault: z.boolean().optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
})

export const assessmentPutSchema = z.object({
  ratingTableId: z.string().uuid('جدول ارزیابی معتبر نیست'),
  skillGrade: z.string().trim().max(10).nullable(),
  effortGrade: z.string().trim().max(10).nullable(),
  conditionsGrade: z.string().trim().max(10).nullable(),
  consistencyGrade: z.string().trim().max(10).nullable(),
  notes: z.string().trim().max(2000).nullable().optional(),
  copyFromElementId: z.string().uuid().nullable().optional(), // کپی ارزیابی از عنصر مشابه — FR-13
})

// ── تنظیمات ──
export const appSettingsPutSchema = z.object({
  'ui.language': z.enum(['fa', 'en']).optional(),
  'ui.calendar': z.enum(['jalali', 'gregorian']).optional(),
  'ui.digits': z.enum(['persian', 'latin']).optional(),
  'ui.decimals': z.enum(['0', '1', '2', '3', '4']).optional(),
  'backup.autoEnabled': z.enum(['true', 'false']).optional(),
  'backup.intervalMinutes': z.enum(['5', '10', '15', '30', '60', '120', '240']).optional(),
  'backup.retention': z.enum(['3', '5', '10', '20', '50']).optional(),
  'outlier.method': z.enum(['mad', 'iqr']).optional(),
  'outlier.threshold': z.enum(['3', '3.5', '4']).optional(),
})

export const projectCalcSettingsSchema = z.object({
  allowanceMethod: z.enum(ALLOWANCE_METHODS).optional(),
  aggregationMethod: z.enum(AGGREGATION_METHODS).optional(),
})

// ── نهایی‌سازی — FR-12 ──
export const finalizeSchema = z.object({
  reason: z.string().trim().max(2000).nullable().optional(), // دلیل نهایی‌سازی با کمبود نمونه
})

// ── بازیابی پشتیبان — FR-24 ──
export const restoreSchema = z.object({
  confirmReplace: z.literal(true, { message: 'برای بازیابی، تأیید صریح جایگزینی داده‌ها الزامی است' }),
})

// ── خروجی نوع‌ها ──
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>
export type StationCreateInput = z.infer<typeof stationCreateSchema>
export type StationUpdateInput = z.infer<typeof stationUpdateSchema>
export type ActivityCreateInput = z.infer<typeof activityCreateSchema>
export type ActivityUpdateInput = z.infer<typeof activityUpdateSchema>
export type ElementCreateInput = z.infer<typeof elementCreateSchema>
export type ElementUpdateInput = z.infer<typeof elementUpdateSchema>
export type OperatorCreateInput = z.infer<typeof operatorCreateSchema>
export type OperatorUpdateInput = z.infer<typeof operatorUpdateSchema>
export type GroupCreateInput = z.infer<typeof groupCreateSchema>
export type GroupUpdateInput = z.infer<typeof groupUpdateSchema>
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>
export type RatingTableCreateInput = z.infer<typeof ratingTableCreateSchema>
export type AssessmentPutInput = z.infer<typeof assessmentPutSchema>
