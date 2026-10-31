/**
 * قراردادهای تبادل UI ↔ API — فاز ۲ (کارگاه پیکربندی، فرمول، مقدار، فعالیت).
 * سرور این شکل‌ها را تولید می‌کند و UI بدون آگاهی از Prisma از آن‌ها استفاده می‌کند.
 */

// ── انواع پایه (مطابق modules/config/domain/snapshot) ──────

export type ConfigParameterDataType =
  | "shortText" | "longText" | "integer" | "decimal" | "percent" | "ratio"
  | "duration" | "dateTime" | "boolean" | "singleSelect" | "multiSelect"
  | "quantityWithUnit" | "entityRef" | "computed";

export type ConfigAnalysisRole = "input" | "grouping" | "filter" | "variable" | "outputIndex" | "informational";

export type ConfigFormulaScopeLevel =
  | "observation" | "element" | "cycle" | "cycleSet" | "group" | "project" | "balanceScenario";

export type ConfigWorkType =
  | "operatorManual" | "machineAuto" | "waiting" | "transport"
  | "inspection" | "setupChangeover" | "overlap";

// ── پیکربندی ────────────────────────────────────────────────

export interface ConfigParameterDto {
  stableKey: string;
  nameFa: string;
  description?: string;
  helpFa?: string;
  code?: string;
  dataType: ConfigParameterDataType;
  analysisRole: ConfigAnalysisRole;
  required?: boolean;
  defaultValue?: string | number | boolean | null;
  min?: number;
  max?: number;
  precision?: number;
  rounding?: "floor" | "ceil" | "round" | "none";
  unit?: string;
  options?: Array<{ value: string; labelFa: string }>;
  optionsSource?: { type: "manual"; noteFa?: string } | { type: "familyRef"; familyKey: string };
  visibilityCondition?: string;
  requiredCondition?: string;
  computedFormulaKey?: string;
  displayContexts: Array<"form" | "table" | "chart" | "report">;
  configurableOnCreate?: boolean;
  suggestionNoteFa?: string;
  customAttrs?: Record<string, string | number | boolean>;
  defVersion: number;
  archived?: boolean;
}

export interface ConfigFamilyDto {
  stableKey: string;
  nameFa: string;
  description?: string;
  code?: string;
  order: number;
  optionalOnCreate?: boolean;
  archived?: boolean;
  parameters: ConfigParameterDto[];
}

export interface ConfigFormulaDto {
  key: string;
  nameFa: string;
  semver: string;
  scopeLevel: ConfigFormulaScopeLevel;
  status: "draft" | "active" | "deprecated";
  descriptionFa: string;
  expr: string;
  outputUnit?: string;
  origin: "system" | "custom";
  inputContract?: Record<string, { type: string; unit?: string; noteFa?: string }>;
  sourceRef?: { type: string; name: string; version?: string; url?: string };
  assumptionsFa?: string[];
  availabilityNoteFa?: string;
}

export interface ConfigActivityModelDto {
  workTypes: ConfigWorkType[];
  notesFa?: string;
  elementTemplates: Array<{
    stableKey: string;
    nameFa: string;
    workType: ConfigWorkType;
    description?: string;
    vaClassification?: string;
  }>;
}

export interface ConfigSnapshotDto {
  snapshotVersion: "2";
  families: ConfigFamilyDto[];
  formulas: ConfigFormulaDto[];
  activityModel: ConfigActivityModelDto;
  timingMethod?: { default: "continuous" | "snapback" | "laps"; notesFa?: string };
  analysisChain: Array<{ step: number; nameFa: string; descriptionFa: string; formulaRefs?: string[] }>;
  reportTemplates: Array<{ id: string; nameFa: string; descriptionFa?: string }>;
}

export interface CurrentConfigDto {
  projectId: string;
  versionId: string | null;
  semver: string | null;
  snapshot: ConfigSnapshotDto;
  versionCount: number;
  formulaCycleRisk: string[][];
}

// ── عملیات تغییر ────────────────────────────────────────────

export interface ConfigOperationInput {
  op: string;
  [key: string]: unknown;
}

export interface AppliedVersionDto {
  versionId: string;
  semver: string;
  reason: string;
  snapshot: ConfigSnapshotDto;
  summary: {
    familiesTouched: string[];
    parametersTouched: Array<{ key: string; defVersion: number }>;
    formulasTouched: Array<{ key: string; semver: string }>;
    operationsApplied: number;
  };
}

// ── اعتبارسنجی/آزمون فرمول ──────────────────────────────────

export interface FormulaValidationDto {
  parseOk: boolean;
  errors: Array<{ code: string; messageFa: string }>;
  warnings: Array<{ messageFa: string }>;
  refs: { parameters: string[]; formulaResults: string[]; unknown: string[] };
  inferredType: string;
  symbols: Array<{ name: string; type: string; unit?: string; source: "parameter" | "formulaResult" }>;
}

export interface FormulaTestDto {
  status: "valid" | "invalid" | "incomplete";
  value: number | string | boolean | null | Array<number | string | boolean | null>;
  unit?: string;
  errors: Array<{ code: string; messageFa: string }>;
  trace: Array<{ nodeId: number; op: string; detail?: string; value?: unknown; unit?: string | null }>;
  inputRefs: string[];
}

export interface FunctionCatalogDto {
  name: string;
  nameFa: string;
  descriptionFa: string;
  signature: string;
}

// ── مقدار پارامتر ───────────────────────────────────────────

export interface ParamValueDto {
  stableKey: string;
  nameFa: string;
  familyName: string;
  dataType: string;
  /** نسخه تعریفی که مقدار به آن گره خورده */
  defVersion: number;
  /** نسخه تعریف فعلی snapshot */
  currentDefVersion: number;
  value: number | string | boolean | null | Array<number | string | boolean | null>;
  unit?: string;
  required: boolean;
  options?: Array<{ value: string; labelFa: string }>;
  visibilityCondition?: string;
  requiredCondition?: string;
  suggestionNoteFa?: string;
  updatedAt: string | null;
}

// ── نتیجه فرمول ─────────────────────────────────────────────

export interface FormulaResultDto {
  id: string;
  formulaKey: string;
  formulaNameFa: string;
  formulaSemver: string;
  scopeLevel: string;
  status: "valid" | "invalid" | "incomplete";
  value: number | string | boolean | null | Array<number | string | boolean | null>;
  unit?: string;
  errors: Array<{ code: string; messageFa: string }>;
  trace: Array<{ nodeId: number; op: string; detail?: string; value?: unknown; unit?: string | null }>;
  inputRefs: string[];
  configVersionId: string;
  computedAt: string;
}

// ── فعالیت ──────────────────────────────────────────────────

export interface ActivityDto {
  id: string;
  stableKey: string;
  name: string;
  description: string | null;
  workType: string;
  vaClassification: string | null;
  stationHint: string | null;
  skillRequired: string | null;
  sourceOfTime: string;
  order: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── import/export ────────────────────────────────────────────

export interface ConfigExportPayloadDto {
  format: "timing-config-snapshot";
  formatVersion: "2";
  exportedAt: string;
  projectCode: string;
  projectTitle: string;
  configSemver: string;
  snapshot: ConfigSnapshotDto;
}

export interface ConfigImportReportDto {
  valid: boolean;
  issues: Array<{ path: string; messageFa: string }>;
  cycleCount: number;
  applied?: { versionId: string; semver: string };
}

// ── الگوهای اعتبارسنجی کلید (هم‌راستا با سرور — منبع: config/domain/validation) ──
export const STABLE_KEY_RE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/;
export const FORMULA_KEY_RE = /^(TS|ST|LB|MM)-\d{3}$|^f\.[a-z][a-zA-Z0-9]*$/;
export const ACTIVITY_KEY_RE = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;

// ── برچسب‌های فارسی UI ───────────────────────────────────────

export const DATA_TYPE_LABELS_FA: Record<ConfigParameterDataType, string> = {
  shortText: "متن کوتاه",
  longText: "متن بلند",
  integer: "عدد صحیح",
  decimal: "عدد اعشاری",
  percent: "درصد",
  ratio: "نسبت",
  duration: "زمان/مدت",
  dateTime: "تاریخ/زمان",
  boolean: "بولی",
  singleSelect: "انتخاب تکی",
  multiSelect: "انتخاب چندگانه",
  quantityWithUnit: "مقدار دارای واحد",
  entityRef: "ارجاع به موجودیت",
  computed: "محاسباتی",
};

export const ANALYSIS_ROLE_LABELS_FA: Record<ConfigAnalysisRole, string> = {
  input: "ورودی",
  grouping: "ویژگی گروه‌بندی",
  filter: "فیلتر",
  variable: "متغیر محاسباتی",
  outputIndex: "شاخص خروجی",
  informational: "اطلاعاتی",
};

export const SCOPE_LEVEL_LABELS_FA: Record<ConfigFormulaScopeLevel, string> = {
  observation: "مشاهده",
  element: "عنصر",
  cycle: "چرخه",
  cycleSet: "مجموعه چرخه‌ها",
  group: "گروه",
  project: "پروژه",
  balanceScenario: "سناریوی بالانس",
};

export const WORK_TYPE_LABELS_FA_UI: Record<ConfigWorkType, string> = {
  operatorManual: "دستی اپراتور",
  machineAuto: "خودکار ماشین",
  waiting: "انتظار/تأخیر",
  transport: "حرکت/جابه‌جایی",
  inspection: "بازرسی",
  setupChangeover: "راه‌اندازی/تعویض",
  overlap: "هم‌پوشان",
};

export const FORMULA_STATUS_LABELS_FA: Record<string, string> = {
  draft: "پیش‌نویس",
  active: "فعال",
  deprecated: "منسوخ",
};

export const AVAILABLE_UNITS_UI: Array<{ symbol: string; nameFa: string }> = [
  { symbol: "ms", nameFa: "میلی‌ثانیه" },
  { symbol: "s", nameFa: "ثانیه" },
  { symbol: "min", nameFa: "دقیقه" },
  { symbol: "h", nameFa: "ساعت" },
  { symbol: "mm", nameFa: "میلی‌متر" },
  { symbol: "cm", nameFa: "سانتی‌متر" },
  { symbol: "m", nameFa: "متر" },
  { symbol: "km", nameFa: "کیلومتر" },
  { symbol: "pcs", nameFa: "عدد" },
  { symbol: "percent", nameFa: "درصد" },
  { symbol: "ratio", nameFa: "نسبت" },
];
