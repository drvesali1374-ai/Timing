/**
 * قراردادهای تبادل UI ↔ API — فاز ۶ (بالانس خط و نیروی کار B10).
 * سرور این شکل‌ها را تولید می‌کند و UI بدون آگاهی از Prisma/ماژول‌ها از آن‌ها استفاده
 * می‌کند (قاعده مرزها — الگوی فاز ۴/۵). منطق دامنه در shared/balance است.
 */

import type {
  BalanceActivity,
  BalanceAlgorithmId,
  BalanceMetrics,
  BalanceSolution,
  BalanceStatus,
  ConstraintViolation,
  ObjectiveWeights,
  PrecedenceGraphCheck,
  StationLoad,
  TaktInput,
  TimeBasis,
} from "@/shared/balance/types";

// ─────────────────────── ورودی‌های سناریو (B10) ───────────────────────

export interface BalanceScenarioInputs {
  /** مبنای زمان انتخابی (بند ۱) */
  timeBasis: TimeBasis;
  /** تاکت مستقیم یا از تقاضا (بند ۱) */
  takt: TaktInput;
  /** سقف ایستگاه — null = نامحدود */
  maxStations: number | null;
  /** وزن اهداف (بند ۵) */
  objectives: ObjectiveWeights;
  /** بازتنظیم دستی زمان فعالیت‌ها (ms) — stableKey → ms */
  activityTimeOverrides: Record<string, number>;
  /** تخصیص وضع موجود (مرجع مقایسه) — stableKey → ایستگاه ۱-مبنا */
  referenceAssignment: Record<string, number> | null;
}

// ─────────────────────── DTOها ───────────────────────

export interface BalanceScenarioDto {
  id: string;
  projectId: string;
  name: string;
  status: "active" | "archived";
  inputs: BalanceScenarioInputs;
  notes: string | null;
  resultCount: number;
  currentResult: BalanceResultDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface BalanceResultDto {
  id: string;
  algorithm: BalanceAlgorithmId;
  algorithmLabelFa: string;
  algorithmVersion: string;
  status: BalanceStatus;
  assignments: Record<string, number>;
  stations: StationLoad[];
  metrics: BalanceMetrics;
  violations: ConstraintViolation[];
  respectedConstraintsCount: number;
  notesFa: string[];
  runMs: number;
  createdAt: string;
}

/** آمادگی داده برای بالانس — صادقانه (بدون عدد جعلی) */
export interface BalanceReadinessDto {
  activitiesTotal: number;
  activitiesActive: number;
  /** فعالیت‌های دارای زمان از تحلیل فاز ۵ بر مبنای انتخابی */
  activitiesWithTime: Record<TimeBasis, number>;
  finalizedSessions: number;
  graphCheck: PrecedenceGraphCheck;
}

export interface BalanceOverviewDto {
  projectId: string;
  scenarios: BalanceScenarioDto[];
  readiness: BalanceReadinessDto;
  /** فعالیت‌ها برای فرم‌های ورودی (بدون زمان — زمان در problem آمده) */
  activities: Array<{
    id: string;
    name: string;
    workType: string;
    workTypeLabelFa: string;
    predecessors: string[];
    hasAnalysisTime: boolean;
  }>;
}

export interface BalanceProblemDto {
  activities: BalanceActivity[];
  taktMs: number;
  taktSourceFa: string;
  maxStations: number | null;
  objectives: ObjectiveWeights;
  graphCheck: PrecedenceGraphCheck;
}

export interface BalanceScenarioDetailDto {
  scenario: BalanceScenarioDto;
  problem: BalanceProblemDto;
  currentResult: BalanceResultDto | null;
  results: BalanceResultDto[];
}

export interface SolveResponseDto {
  result: BalanceResultDto;
}

export interface ManualAssignmentResponseDto {
  result: BalanceResultDto;
  /** قیود سخت نقض‌شده — در صورت وجود، ذخیره رد شده و ۴۰۰ برگردانده می‌شود */
  hardViolationsFa: string[];
}

// ─────────────────────── خروجی/گزارش ───────────────────────

export const BALANCE_EXPORT_FORMATS = ["csv", "xls", "json"] as const;
export type BalanceExportFormat = (typeof BALANCE_EXPORT_FORMATS)[number];

export const BALANCE_REPORT_TEMPLATES = ["balance-summary", "station-assignments", "scenario-comparison"] as const;
export type BalanceReportTemplate = (typeof BALANCE_REPORT_TEMPLATES)[number];

export const BALANCE_REPORT_TEMPLATE_LABELS_FA: Record<BalanceReportTemplate, string> = {
  "balance-summary": "خلاصه بالانس و شاخص‌ها",
  "station-assignments": "ماتریس تخصیص ایستگاه‌ها",
  "scenario-comparison": "مقایسه سناریو/وضع موجود",
};

export interface BalanceExportResult {
  format: BalanceExportFormat;
  contentType: string;
  fileName: string;
  body: string;
}

// ─────────────────────── صادرات مجاز انواع هسته برای UI ───────────────────────

export type {
  BalanceActivity,
  BalanceAlgorithmId,
  BalanceMetrics,
  BalanceSolution,
  BalanceStatus,
  ConstraintViolation,
  ObjectiveWeights,
  PrecedenceGraphCheck,
  StationLoad,
  TaktInput,
  TimeBasis,
};
