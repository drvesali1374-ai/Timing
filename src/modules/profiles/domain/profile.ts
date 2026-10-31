/**
 * دامنه ماژول پروفایل‌ها — نوع «تعریف پروفایل» به‌عنوان منبع کد-محور.
 * تعریف‌های نسخه‌دار در `definitions/` قرار دارند و با اسکریپت seed به
 * ProfileTemplate در پایگاه داده همگام می‌شوند (idempotent بر اساس id+semver).
 * پیاده‌سازی بر اساس docs/PROFILES.md §۱ و ADR-005 (کپی هنگام ایجاد پروژه).
 *
 * فاز ۲: محتوای پروفایل به ساختار v2 تبدیل می‌شود — خانواده‌ها با defVersion،
 * فرمول‌های ارجاعی با تعریف اجرایی از کتابخانه فرمول‌های سیستمی ترکیب می‌شوند
 * و مدل فعالیت (B5) وارد محتوا می‌شود (بند ۷ فاز ۲).
 */

import type {
  AnalysisRole,
  ParameterDataType,
  ProfileContentDto,
  ProfileSourceDto,
} from "@/shared/contracts/api";
import { SYSTEM_FORMULA_LIBRARY } from "../definitions/formula-library";
import type { SnapshotFormulaDef } from "@/shared/contracts/snapshot";

/** پارامتر داخل محتوای پروفایل (نسخه کد-محور — شکل v1 نگه‌داشته می‌شود و در buildV2Content ارتقا می‌یابد) */
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
  /** مدل فعالیت (B5) — اختیاری؛ پیش‌فرض انواع هفت‌گانه کار بدون قالب عنصر */
  activityModel?: {
    workTypes?: Array<
      "operatorManual" | "machineAuto" | "waiting" | "transport" | "inspection" | "setupChangeover" | "overlap"
    >;
    notesFa?: string;
    elementTemplates?: Array<{
      stableKey: string;
      nameFa: string;
      workType: "operatorManual" | "machineAuto" | "waiting" | "transport" | "inspection" | "setupChangeover" | "overlap";
      description?: string;
      vaClassification?: "valueAdded" | "nonValueAdded" | "essentialNonVA";
    }>;
  };
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

// ── تبدیل محتوای v1 → v2 (نمایندگی — واحد‌های فارسی به نماد رجیستری نگاشت می‌شوند) ──

const UNIT_NORMALIZE: Record<string, string | undefined> = {
  "%": "percent",
  "واحد": "pcs",
  "شیفت": undefined, // تعداد شیفت بی‌بُعد است — نام پارامتر گویاست
  "s": "s",
  "ثانیه": "s",
  "دقیقه": "min",
  "متر": "m",
};

export interface V2Content {
  snapshotVersion: "2";
  families: Array<{
    stableKey: string;
    nameFa: string;
    description?: string;
    order: number;
    optionalOnCreate?: boolean;
    parameters: Array<ProfileParameterDef & { defVersion: number; unit?: string }>;
  }>;
  formulas: SnapshotFormulaDef[];
  activityModel: {
    workTypes: NonNullable<ProfileContentDef["activityModel"]>["workTypes"];
    notesFa?: string;
    elementTemplates: NonNullable<ProfileContentDef["activityModel"]>["elementTemplates"];
  };
  timingMethod?: ProfileContentDef["timingMethod"];
  analysisChain: ProfileAnalysisChainStepDef[];
  reportTemplates: ProfileContentDef["reportTemplates"];
}

/**
 * ساخت محتوای v2 از تعریف پروفایل:
 *  - پارامترها defVersion:1 می‌گیرند و واحدشان به نماد رجیستری نگاشت می‌شود
 *  - فرمول‌های ارجاعی با تعریف اجرایی کتابخانه سیستمی غنی می‌شوند (اگر موجود باشد)
 *  - مدل فعالیت پیش‌فرض انواع هفت‌گانه B5 است مگر آنکه پروفایل مدل خاص خود را داشته باشد
 */
export function buildV2Content(def: { content: ProfileContentDef }): V2Content {
  const families = def.content.families.map((f) => ({
    stableKey: f.stableKey,
    nameFa: f.nameFa,
    description: f.description,
    order: f.order,
    optionalOnCreate: f.optionalOnCreate,
    parameters: f.parameters.map((p) => {
      const unit = p.unit !== undefined ? UNIT_NORMALIZE[p.unit] : undefined;
      return { ...p, defVersion: 1, ...(unit !== undefined ? { unit } : {}) };
    }),
  }));

  const formulas: SnapshotFormulaDef[] = def.content.formulas.map((ref) => {
    const libraryEntry = Object.prototype.hasOwnProperty.call(SYSTEM_FORMULA_LIBRARY, ref.id)
      ? SYSTEM_FORMULA_LIBRARY[ref.id]
      : null;
    if (libraryEntry) {
      // تعریف اجرایی کتابخانه + توضیح اختصاصی پروفایل (اگر متفاوت بود، توضیح پروفایل اولویت دارد)
      return {
        ...libraryEntry,
        descriptionFa: ref.descriptionFa || libraryEntry.descriptionFa,
        status: ref.status,
      };
    }
    // بدون تعریف اجرایی — ارجاع صادقانه
    return {
      key: ref.id,
      nameFa: ref.nameFa,
      semver: ref.semver,
      scopeLevel: ref.scopeLevel,
      status: ref.status,
      descriptionFa: ref.descriptionFa,
      expr: "",
      origin: "system" as const,
      availabilityNoteFa: "فرمول ارجاعی بدون عبارت اجرایی در این نسخه — در کارگاه پیکربندی قابل جایگزینی است.",
    };
  });

  const activityModel = {
    workTypes: def.content.activityModel?.workTypes ?? [
      "operatorManual",
      "machineAuto",
      "waiting",
      "transport",
      "inspection",
      "setupChangeover",
      "overlap",
    ] as NonNullable<ProfileContentDef["activityModel"]>["workTypes"],
    notesFa: def.content.activityModel?.notesFa,
    elementTemplates: def.content.activityModel?.elementTemplates ?? [],
  };

  return {
    snapshotVersion: "2",
    families,
    formulas,
    activityModel,
    timingMethod: def.content.timingMethod,
    analysisChain: def.content.analysisChain,
    reportTemplates: def.content.reportTemplates,
  };
}

/** snapshot ذخیره‌شده در ConfigVersion هنگام ایجاد پروژه از پروفایل (v2) */
export interface ProfileSnapshot {
  snapshotVersion: "2";
  meta: {
    templateId: string;
    templateVersion: string;
    instantiatedAt: string;
    excludedFamilies: string[];
    parameterOverrides: Array<{ stableKey: string; value: string | number | boolean }>;
  };
  content: V2Content;
}

/** منطق فیلتر اجزا هنگام ایجاد پروژه — بدون هیچ تبدیل پنهانی (ورودی/خروجی v2) */
export function instantiateSnapshot(
  def: { id: string; semver: string; content: V2Content },
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
    snapshotVersion: "2",
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
