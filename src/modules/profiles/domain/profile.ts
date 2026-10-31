/**
 * دامنه ماژول پروفایل‌ها — نوع «تعریف پروفایل» به‌عنوان منبع کد-محور.
 * تعریف‌های نسخه‌دار در `definitions/` قرار دارند و با اسکریپت seed به
 * ProfileTemplate در پایگاه داده همگام می‌شوند (idempotent بر اساس id+semver).
 * پیاده‌سازی بر اساس docs/PROFILES.md §۱ و ADR-005 (کپی هنگام ایجاد پروژه).
 */

import type {
  AnalysisRole,
  ParameterDataType,
  ProfileContentDto,
  ProfileSourceDto,
} from "@/shared/contracts/api";

/** پارامتر داخل محتوای پروفایل (نسخه کد-محور) */
export interface ProfileParameterDef {
  stableKey: string;
  nameFa: string;
  description?: string;
  helpFa?: string;
  dataType: ParameterDataType;
  analysisRole: AnalysisRole;
  required?: boolean;
  defaultValue?: string | number | boolean;
  min?: number;
  max?: number;
  unit?: string;
  options?: Array<{ value: string; labelFa: string }>;
  configurableOnCreate?: boolean;
  suggestionNoteFa?: string;
  displayContexts: Array<"form" | "table" | "chart" | "report">;
}

export interface ProfileFamilyDef {
  stableKey: string;
  nameFa: string;
  description?: string;
  order: number;
  optionalOnCreate?: boolean;
  parameters: ProfileParameterDef[];
}

export interface ProfileFormulaRefDef {
  id: string;
  nameFa: string;
  semver: string;
  scopeLevel: ProfileContentDto["formulas"][number]["scopeLevel"];
  status: "draft" | "active" | "deprecated";
  descriptionFa: string;
}

export interface ProfileAnalysisChainStepDef {
  step: number;
  nameFa: string;
  descriptionFa: string;
  formulaRefs?: string[];
}

export interface ProfileContentDef {
  families: ProfileFamilyDef[];
  timingMethod?: { default: "continuous" | "snapback" | "laps"; notesFa?: string };
  analysisChain: ProfileAnalysisChainStepDef[];
  formulas: ProfileFormulaRefDef[];
  reportTemplates: Array<{ id: string; nameFa: string; descriptionFa?: string }>;
}

export type ProfileSourceDef = ProfileSourceDto;

export interface ProfileDefinition {
  /** شناسه پایدار الگو مثل "profile.general-industrial-time-study" */
  id: string;
  semver: string;
  nameFa: string;
  description: string;
  scopeOfUse: string;
  source: ProfileSourceDef;
  assumptions: string[];
  limitations: string[];
  licenseNote: string;
  isDefault?: boolean;
  content: ProfileContentDef;
}

/** snapshot ذخیره‌شده در ConfigVersion هنگام ایجاد پروژه از پروفایل */
export interface ProfileSnapshot {
  snapshotVersion: "1";
  meta: {
    templateId: string;
    templateVersion: string;
    instantiatedAt: string;
    excludedFamilies: string[];
    parameterOverrides: Array<{ stableKey: string; value: string | number | boolean }>;
  };
  content: ProfileContentDef;
}

/** منطق فیلتر اجزا هنگام ایجاد پروژه — بدون هیچ تبدیل پنهانی */
export function instantiateSnapshot(
  def: { id: string; semver: string; content: ProfileContentDef },
  components: { excludedFamilies: string[]; parameterOverrides: Array<{ stableKey: string; value: string | number | boolean }> },
): ProfileSnapshot {
  const excluded = new Set(components.excludedFamilies);
  const overrides = new Map(components.parameterOverrides.map((o) => [o.stableKey, o.value]));
  const families = def.content.families
    .filter((f) => !excluded.has(f.stableKey))
    .map((f) => ({
      ...f,
      parameters: f.parameters.map((p) =>
        overrides.has(p.stableKey) && p.configurableOnCreate
          ? { ...p, defaultValue: overrides.get(p.stableKey) as ProfileParameterDef["defaultValue"] }
          : p,
      ),
    }));
  return {
    snapshotVersion: "1",
    meta: {
      templateId: def.id,
      templateVersion: def.semver,
      instantiatedAt: new Date().toISOString(),
      excludedFamilies: [...excluded],
      parameterOverrides: components.parameterOverrides.filter((o) =>
        def.content.families.some((f) => f.parameters.some((p) => p.stableKey === o.stableKey && p.configurableOnCreate)),
      ),
    },
    content: { ...def.content, families },
  };
}
