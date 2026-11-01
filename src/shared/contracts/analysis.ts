/**
 * قراردادهای تبادل UI ↔ API — فاز ۵ (تحلیل مهندسی زمان B9/B4).
 * سرور این شکل‌ها را تولید می‌کند و UI بدون آگاهی از Prisma/ماژول‌ها از آن‌ها استفاده می‌کند
 * (قاعده مرزها: UI فقط shared + lib کلاینت — الگوی فاز ۴).
 * منطق دامنه (zod/اعتبارسنجی) در modules/analysis/domain است — اینجا فقط انواع قرارداد.
 */

import type {
  AggregationMethod,
  AllowanceMethod,
  AnalysisObservation,
  AnalysisSettings,
  ChainStepStatus,
  DescriptiveStats,
  ElementAnalysis,
  FormulaEvalTrace,
  Histogram,
  MarkedObservation,
  ObservationCounts,
  OutlierDetection,
  SampleQuality,
  SessionAnalysisSummary,
  TimeChain,
} from "@/shared/analysis/types";

// ─────────────────────── قالب گزارش/خروجی ───────────────────────

export const EXPORT_FORMATS = ["csv", "xls", "json"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const REPORT_TEMPLATES = [
  "study-summary",
  "raw-observations",
  "element-analysis",
  "sample-quality",
  "standard-time",
  "formula-outputs",
] as const;
export type ReportTemplate = (typeof REPORT_TEMPLATES)[number];

export const REPORT_TEMPLATE_LABELS_FA: Record<ReportTemplate, string> = {
  "study-summary": "خلاصه مطالعه",
  "raw-observations": "جدول مشاهدات خام",
  "element-analysis": "تحلیل عنصر",
  "sample-quality": "کیفیت نمونه",
  "standard-time": "گزارش زمان نرمال/استاندارد",
  "formula-outputs": "خروجی فرمول‌ها",
};

export interface ReportColumn {
  key: string;
  labelFa: string;
}

export interface ReportRow {
  [key: string]: string | number | null;
}

// ─────────────────────── ورودی‌های API ───────────────────────

export interface MarkObservationInput {
  sessionId: string;
  readingEventId: string;
  cycleSeq: number;
  elementKey: string;
  /** عمل ۱: علامت «داده پرت» (بدون حذف) */
  outlierMarked: boolean;
  /** عمل ۲: حذف از محاسبه — جدا از علامت؛ نیازمند علت */
  excluded: boolean;
  reason?: string | null;
}

export interface SessionContextInput {
  sessionId: string;
  values: Array<{ stableKey: string; value: string | number | boolean | null }>;
}

// ─────────────────────── DTOهای تحلیل ───────────────────────

export interface SettingsSourceNote {
  stableKey: string;
  nameFa: string;
  valueLabelFa: string;
  /** یادداشت صداقت — مثل «پیشنهاد — استاندارد جهانی نیست» */
  noteFa: string | null;
}

export interface FormulaCatalogEntry {
  key: string;
  nameFa: string;
  semver: string;
  scopeLevel: string;
  status: string;
  sourceFa: string;
  assumptionsFa: string[];
  descriptionFa: string;
}

export interface ProfileSourceDto {
  templateId: string | null;
  templateVersion: string | null;
  nameFa: string | null;
  sourceName: string | null;
  sourceVersion: string | null;
  sourceUrl: string | null;
  assumptionsFa: string[];
  limitationsFa: string[];
}

export interface AnalysisTraceBlock {
  configVersionId: string | null;
  configSemver: string | null;
  generatedAt: string;
  settings: AnalysisSettings;
  formulaVersions: Array<{ key: string; semver: string }>;
  inputSummaryFa: string;
  methodologyNotesFa: string[];
}

export interface StandardCycleTotal {
  status: "valid" | "incomplete";
  /** Σ زمان استاندارد عناصر معتبر چرخه (ms) */
  totalMs: number | null;
  validElements: number;
  incompleteElements: number;
  warningsFa: string[];
}

export interface AnalysisDto {
  projectId: string;
  projectCode: string;
  projectTitle: string;
  profile: ProfileSourceDto;
  settings: AnalysisSettings;
  settingsSources: SettingsSourceNote[];
  sessions: SessionAnalysisSummary[];
  elements: ElementAnalysis[];
  standardCycle: StandardCycleTotal;
  formulaCatalog: FormulaCatalogEntry[];
  marksHistoryCount: number;
  trace: AnalysisTraceBlock;
  /** یادداشت‌های راهنمای تحلیل — منابع و نبودِ استاندارد جهانی (بند ۹) */
  guideFa: string[];
}

export interface MarkHistoryDto {
  readingEventId: string;
  history: Array<{
    id: string;
    outlierMarked: boolean;
    excluded: boolean;
    reason: string | null;
    markedBy: string;
    createdAt: string;
  }>;
  current: { outlierMarked: boolean; excluded: boolean; reason: string | null; markedBy: string; markedAt: string } | null;
}

export interface ReportDto {
  template: ReportTemplate;
  templateLabelFa: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  summaryFa: string[];
  trace: AnalysisTraceBlock;
  fileNameBase: string;
}

export interface ExportResult {
  format: ExportFormat;
  contentType: string;
  fileName: string;
  body: string;
  resultId: string | null;
}

// ─────────────────────── صادرات مجاز انواع هسته برای UI ───────────────────────

export type {
  AggregationMethod,
  AllowanceMethod,
  AnalysisObservation,
  AnalysisSettings,
  ChainStepStatus,
  DescriptiveStats,
  ElementAnalysis,
  FormulaEvalTrace,
  Histogram,
  MarkedObservation,
  ObservationCounts,
  OutlierDetection,
  SampleQuality,
  SessionAnalysisSummary,
  TimeChain,
};
