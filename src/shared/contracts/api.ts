/**
 * قراردادهای تبادل UI ↔ API (DTO) — فاز ۱.
 * سرور این شکل‌ها را تولید می‌کند و UI بدون آگاهی از Prisma از آن‌ها استفاده می‌کند.
 * (قاعده معماری: ارتباط بین‌ماژولی/لایه‌ای فقط از طریق قراردادهای shared)
 */
import type { ProjectRole } from "./acl";

// ── نشست / کاربر ───────────────────────────────────────────

export interface SessionUserDto {
  id: string;
  email: string;
  name: string | null;
}

export interface RegisterResultDto {
  user: SessionUserDto;
  messageFa: string;
}

// ── پروفایل‌های روش‌شناختی ──────────────────────────────────

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

export interface ProfileOptionDto {
  value: string;
  labelFa: string;
}

export interface ProfileParameterDto {
  stableKey: string;
  nameFa: string;
  description?: string;
  helpFa?: string;
  dataType: ParameterDataType;
  analysisRole: AnalysisRole;
  required?: boolean;
  defaultValue?: unknown;
  min?: number;
  max?: number;
  unit?: string;
  options?: ProfileOptionDto[];
  /** در پریز ایجاد پروژه قابل خاموش/تنظیم است (گام «اجزای پروفایل») */
  configurableOnCreate?: boolean;
  /** برچسب صداقت برای مقادیر پیشنهادی (مثل «پیشنهاد — تنظیم با شرایط کاری») */
  suggestionNoteFa?: string;
  displayContexts: Array<"form" | "table" | "chart" | "report">;
}

export interface ProfileFamilyDto {
  stableKey: string;
  nameFa: string;
  description?: string;
  order: number;
  /** اجزا در ایجاد پروژه قابل حذف‌اند */
  optionalOnCreate?: boolean;
  parameters: ProfileParameterDto[];
}

export interface ProfileFormulaRefDto {
  id: string; // مثل "TS-010"
  nameFa: string;
  semver: string;
  scopeLevel:
    | "observation"
    | "element"
    | "cycle"
    | "cycleSet"
    | "group"
    | "project"
    | "balanceScenario";
  status: "draft" | "active" | "deprecated";
  descriptionFa: string;
}

export interface ProfileAnalysisChainStepDto {
  step: number;
  nameFa: string;
  descriptionFa: string;
  formulaRefs?: string[];
}

export interface ProfileTimingMethodDto {
  default: "continuous" | "snapback" | "laps";
  notesFa?: string;
}

export interface ProfileReportTemplateDto {
  id: string;
  nameFa: string;
  descriptionFa?: string;
}

export interface ProfileContentDto {
  families: ProfileFamilyDto[];
  timingMethod?: ProfileTimingMethodDto;
  analysisChain: ProfileAnalysisChainStepDto[];
  formulas: ProfileFormulaRefDto[];
  reportTemplates: ProfileReportTemplateDto[];
}

export interface ProfileSourceDto {
  type: string;
  name: string;
  version: string;
  url?: string | null;
}

export interface ProfileSummaryDto {
  id: string;
  semver: string;
  nameFa: string;
  description: string;
  scopeOfUse: string;
  source: ProfileSourceDto;
  isDefault: boolean;
  familyCount: number;
  parameterCount: number;
  formulaCount: number;
}

export interface ProfileDetailDto extends ProfileSummaryDto {
  assumptions: string[];
  limitations: string[];
  licenseNote: string | null;
  content: ProfileContentDto;
}

// ── پروژه‌ها ───────────────────────────────────────────────

export const PROJECT_STATUSES = ["active", "archived", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectReadinessDto {
  configReady: boolean;
  measurementReady: boolean;
  analysisReady: boolean;
  approvalReady: boolean;
}

export interface ProjectProfileInfoDto {
  templateId: string | null;
  templateNameFa: string | null;
  templateVersion: string | null;
  snapshotId: string | null;
}

export interface ProjectDto {
  id: string;
  code: string;
  title: string;
  goal: string | null;
  location: string | null;
  department: string | null;
  line: string | null;
  station: string | null;
  product: string | null;
  process: string | null;
  responsible: string | null;
  shift: string | null;
  notes: string | null;
  status: ProjectStatus;
  isDemo: boolean;
  readiness: ProjectReadinessDto;
  profile: ProjectProfileInfoDto;
  currentConfigVersion: { id: string; semver: string } | null;
  configVersionCount: number;
  memberCount: number;
  myRole: ProjectRole | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListDto {
  items: ProjectDto[];
  total: number;
}

// ── نسخه‌های پیکربندی ──────────────────────────────────────

export interface ConfigVersionDto {
  id: string;
  semver: string;
  reason: string | null;
  profileTemplateId: string | null;
  profileTemplateVersion: string | null;
  isCurrent: boolean;
  createdByName: string | null;
  createdAt: string;
  snapshot: unknown; // JSON کامل snapshot (ساختار ProfileSnapshot)
}

// ── اعضا و ممیزی ───────────────────────────────────────────

export interface MemberDto {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: ProjectRole;
  createdAt: string;
}

export interface AuditEntryDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  projectId: string | null;
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
}
