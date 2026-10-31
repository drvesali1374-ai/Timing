/**
 * انواع snapshot پیکربندی v2 — قرارداد مشترک بین‌ماژولی (پروفایل‌ها/پیکربندی/پارامترها).
 * سازنده انواع: ماژول config (معناشناسی)؛ این فایل صرفاً قرارداد نوع است.
 */

import type { SerializedFormulaAst } from "@/shared/formula/ast";

// ── انواع پایه (هم‌راستا با shared/contracts/api) ───────────

export type ParameterDataType =
  | "shortText"
  | "longText"
  | "integer"
  | "decimal"
  | "percent"
  | "ratio"
  | "duration"
  | "dateTime"
  | "boolean"
  | "singleSelect"
  | "multiSelect"
  | "quantityWithUnit"
  | "entityRef"
  | "computed";

export type AnalysisRole =
  | "input"
  | "grouping"
  | "filter"
  | "variable"
  | "outputIndex"
  | "informational";

export type DisplayContext = "form" | "table" | "chart" | "report";

export type FormulaScopeLevel =
  | "observation"
  | "element"
  | "cycle"
  | "cycleSet"
  | "group"
  | "project"
  | "balanceScenario";

export type FormulaStatus = "draft" | "active" | "deprecated";

export type WorkType =
  | "operatorManual"
  | "machineAuto"
  | "waiting"
  | "transport"
  | "inspection"
  | "setupChangeover"
  | "overlap";

export type VaClassification = "valueAdded" | "nonValueAdded" | "essentialNonVA";

export type SourceOfTime = "measured" | "estimated" | "referenced";

// ── پارامتر (B2 کامل) ───────────────────────────────────────

export interface SnapshotParameterDef {
  /** شناسه فنی پایدار — هرگز بازنویسی نمی‌شود */
  stableKey: string;
  nameFa: string;
  description?: string;
  helpFa?: string;
  /** کد نمایشی اختیاری */
  code?: string;
  dataType: ParameterDataType;
  analysisRole: AnalysisRole;
  required?: boolean;
  defaultValue?: string | number | boolean | null;
  min?: number;
  max?: number;
  /** دقت اعشار برای انواع عددی */
  precision?: number;
  /** گردکردن: floor|ceil|round|none */
  rounding?: "floor" | "ceil" | "round" | "none";
  /** واحد در رجیستری واحدهای موتور فرمول (s/min/h/percent/…) */
  unit?: string;
  options?: Array<{ value: string; labelFa: string }>;
  /** منبع گزینه‌ها برای فهرست‌های انتخابی */
  optionsSource?: { type: "manual"; noteFa?: string } | { type: "familyRef"; familyKey: string };
  /** شرط نمایش به زبان DSL — خالی یعنی همیشه */
  visibilityCondition?: string;
  /** شرط اجباری‌شدن به زبان DSL */
  requiredCondition?: string;
  /** فرمول محاسباتی برای dataType=computed (کلید فرمول در snapshot) */
  computedFormulaKey?: string;
  displayContexts: DisplayContext[];
  /** در پریز ایجاد پروژه قابل تنظیم باشد */
  configurableOnCreate?: boolean;
  /** برچسب صداقت برای مقادیر پیشنهادی */
  suggestionNoteFa?: string;
  /** ویژگی‌های سفارشی بدون ستون فیزیکی */
  customAttrs?: Record<string, string | number | boolean>;
  /** نسخه تعریف — هر تغییر ساختاری defVersion++ */
  defVersion: number;
  archived?: boolean;
}

// ── خانواده ─────────────────────────────────────────────────

export interface SnapshotFamilyDef {
  stableKey: string;
  nameFa: string;
  description?: string;
  code?: string;
  order: number;
  optionalOnCreate?: boolean;
  archived?: boolean;
  parameters: SnapshotParameterDef[];
}

// ── فرمول (B3) ──────────────────────────────────────────────

export interface SnapshotFormulaDef {
  /** کلید پایدار — مثل "TS-011" (سیستمی) یا "f.my-formula" (سفارشی) */
  key: string;
  nameFa: string;
  semver: string;
  scopeLevel: FormulaScopeLevel;
  status: FormulaStatus;
  descriptionFa: string;
  /** عبارت DSL منبع (متن انسان‌خوان) */
  expr: string;
  /** AST سریال‌شده — بازتولیدپذیر */
  ast?: SerializedFormulaAst;
  /** واحد خروجی اعلام‌شده (اختیاری) */
  outputUnit?: string;
  /** منشأ: system (کاتالوگ) | custom (کاربر) */
  origin: "system" | "custom";
  /** قرارداد ورودی: نام → نوع/واحد موردانتظار */
  inputContract?: Record<string, { type: "number" | "string" | "boolean" | "numberArray"; unit?: string; noteFa?: string }>;
  /** ارجاع روش‌شناختی */
  sourceRef?: { type: string; name: string; version?: string; url?: string };
  assumptionsFa?: string[];
  /** یادداشت دسترس‌پذیری داده (مثلاً «نیازمند مشاهدات فاز ۴») */
  availabilityNoteFa?: string;
}

// ── مدل فعالیت (B5) ─────────────────────────────────────────

export interface SnapshotActivityModel {
  /** انواع کار مجاز این پروژه */
  workTypes: WorkType[];
  notesFa?: string;
  /** قالب‌های عنصر هنگام ایجاد پروژه نمونه‌سازی می‌شوند (کپی مستقل) */
  elementTemplates: Array<{
    stableKey: string;
    nameFa: string;
    workType: WorkType;
    description?: string;
    vaClassification?: VaClassification;
  }>;
}

// ── زنجیره تحلیل ────────────────────────────────────────────

export interface SnapshotAnalysisChainStep {
  step: number;
  nameFa: string;
  descriptionFa: string;
  formulaRefs?: string[];
}

// ── snapshot کامل ────────────────────────────────────────────

export interface ProjectConfigSnapshot {
  snapshotVersion: "2";
  meta: {
    templateId: string | null;
    templateVersion: string | null;
    instantiatedAt: string;
    /** تاریخچه ارتقا نمایندگی (بدون تبدیل مقدار) */
    upgradedFromV1?: boolean;
    excludedFamilies?: string[];
    parameterOverrides?: Array<{ stableKey: string; value: string | number | boolean }>;
  };
  families: SnapshotFamilyDef[];
  formulas: SnapshotFormulaDef[];
  activityModel: SnapshotActivityModel;
  timingMethod?: { default: "continuous" | "snapback" | "laps"; notesFa?: string };
  analysisChain: SnapshotAnalysisChainStep[];
  reportTemplates: Array<{ id: string; nameFa: string; descriptionFa?: string }>;
}

/**
 * نماد نتیجه فرمول در جدول نمادها — خط تیره به زیرخط (گرامر DSL خط تیره ندارد:
 * «TS-011.result» تفریق تفسیر می‌شد؛ نماد صحیح «TS_011.result» است).
 */
export function formulaResultSymbol(formulaKey: string): string {
  return `${formulaKey.replace(/-/g, "_")}.result`;
}
