/**
 * قراردادهای مشترک ثبت دستی زمان (ADR-017) — مصرف UI و ماژول manual-study.
 * واحدها: durationMs همیشه میلی‌ثانیه؛ نمایش ثانیه‌ای تبدیل لایه UI است.
 */

// ─────────────────── وضعیت برگه ───────────────────

export const MANUAL_SHEET_STATUSES = ["draft", "completed", "finalized"] as const;
export type ManualSheetStatus = (typeof MANUAL_SHEET_STATUSES)[number];

export const MANUAL_SHEET_STATUS_LABELS_FA: Record<ManualSheetStatus, string> = {
  draft: "پیش‌نویس",
  completed: "تکمیل‌شده",
  finalized: "نهایی‌شده (در تحلیل)",
};

/** وضعیت نمایشی «در حال تکمیل» = پیش‌نویسِ دارای داده */
export function manualSheetStatusFa(status: string, hasData: boolean): string {
  if (status === "draft" && hasData) return "در حال تکمیل";
  return MANUAL_SHEET_STATUS_LABELS_FA[status as ManualSheetStatus] ?? status;
}

// ─────────────────── علت‌های وقفه (کاتالوگ صنعتی) ───────────────────

export const INTERRUPTION_REASONS = [
  "fixture-failure",
  "material-shortage",
  "operator-talk",
  "equipment-failure",
  "waiting-transport",
  "tool-change",
  "other",
] as const;
export type InterruptionReason = (typeof INTERRUPTION_REASONS)[number];

export const INTERRUPTION_REASON_LABELS_FA: Record<InterruptionReason, string> = {
  "fixture-failure": "خرابی فیکسچر",
  "material-shortage": "کمبود قطعه",
  "operator-talk": "گفت‌وگوی اپراتور",
  "equipment-failure": "خرابی تجهیز",
  "waiting-transport": "انتظار حمل",
  "tool-change": "تعویض ابزار",
  other: "سایر",
};

// ─────────────────── منبع ثبت مشاهده ───────────────────

export const OBSERVATION_SOURCES = ["manual", "paste", "import"] as const;
export type ObservationSource = (typeof OBSERVATION_SOURCES)[number];

export const OBSERVATION_SOURCE_LABELS_FA: Record<ObservationSource, string> = {
  manual: "ورود دستی",
  paste: "چسباندن از Excel",
  import: "درون‌ریزی فایل",
};

// ─────────────────── DTOها ───────────────────

export interface ManualSheetSummaryDto {
  id: string;
  title: string;
  status: string;
  statusFa: string;
  note: string | null;
  sampleCount: number;
  observationCount: number;
  interruptionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManualCellDto {
  observationId: string;
  sampleIndex: number;
  /** مقدار ثانیه‌ای (نمایش/ویرایش) */
  seconds: number;
  durationMs: number;
  source: string;
  note: string | null;
  outlierMarked: boolean;
  excluded: boolean;
  corrected: boolean;
}

export interface ManualSheetRowDto {
  activityId: string;
  activityName: string;
  activityStableKey: string;
  stationId: string | null;
  stationName: string | null;
  cells: ManualCellDto[];
}

export interface ManualInterruptionDto {
  id: string;
  activityId: string | null;
  activityName: string | null;
  sampleIndex: number | null;
  reason: string;
  reasonFa: string;
  reasonOther: string | null;
  durationMs: number | null;
  durationKnown: boolean;
  note: string | null;
  recordedAt: string;
}

export interface ManualSheetDetailDto {
  id: string;
  title: string;
  status: string;
  statusFa: string;
  note: string | null;
  sampleCount: number;
  observationCount: number;
  interruptionCount: number;
  rows: ManualSheetRowDto[];
  interruptions: ManualInterruptionDto[];
  createdAt: string;
  updatedAt: string;
}

export interface SaveCellsResult {
  saved: number;
  removed: number;
  rejected: Array<{ activityId: string; sampleIndex: number; reasonFa: string }>;
  sampleCount: number;
}

export const MAX_SAMPLES = 60;
export const MAX_SHEET_ACTIVITIES = 200;
