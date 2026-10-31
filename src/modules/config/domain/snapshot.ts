/**
 * Snapshot پیکربندی نسخه ۲ — ساختار کامل فاز ۲ (B2 + B3 + B5).
 *
 * تغییر نسبت به v1 (فاز ۱):
 *  - پارامترها: فیلدهای کامل B2 (کد، دقت، گردکردن، منبع گزینه‌ها، شرط نمایش/اجباری،
 *    فرمول محاسباتی، ویژگی‌های سفارشی، defVersion، بایگانی)
 *  - فرمول‌ها: به‌جای «ارجاع صرف»، عبارت DSL واقعی + AST سریال‌شده + قرارداد ورودی
 *  - مدل فعالیت: مجموعه انواع کار مجاز + قالب‌های عنصر برای نمونه‌سازی هنگام ایجاد پروژه
 *  - families/formulas دارای archived و نسخه‌بندی تعریف
 *
 * قاعده ارتقا v1→v2 (ADR-011): فقط «نمایندگی» ارتقا می‌یابد (فیلدهای جدید مقدار
 * پیش‌فرض می‌گیرند)؛ هیچ مقدار یا معنایی تبدیل نمی‌شود — تبدیل پنهانی ممنوع.
 */

// انواع پایه/خانواده/پارامتر/فرمول/مدل فعالیت → قرارداد مشترک در shared/contracts/snapshot
export type * from "@/shared/contracts/snapshot";
import type {
  AnalysisRole,
  DisplayContext,
  FormulaScopeLevel,
  FormulaStatus,
  ParameterDataType,
  ProjectConfigSnapshot,
  SnapshotActivityModel,
  SnapshotAnalysisChainStep,
} from "@/shared/contracts/snapshot";

// ── ارتقای v1 → v2 (فقط نمایندگی — ADR-011) ─────────────────

interface V1Parameter {
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
  displayContexts: DisplayContext[];
}

interface V1Family {
  stableKey: string;
  nameFa: string;
  description?: string;
  order: number;
  optionalOnCreate?: boolean;
  parameters: V1Parameter[];
}

interface V1FormulaRef {
  id: string;
  nameFa: string;
  semver: string;
  scopeLevel: FormulaScopeLevel;
  status: FormulaStatus;
  descriptionFa: string;
}

interface V1Content {
  families: V1Family[];
  timingMethod?: { default: "continuous" | "snapback" | "laps"; notesFa?: string };
  analysisChain: SnapshotAnalysisChainStep[];
  formulas: V1FormulaRef[];
  reportTemplates: Array<{ id: string; nameFa: string; descriptionFa?: string }>;
}

interface V1Snapshot {
  snapshotVersion: "1";
  meta: {
    templateId: string;
    templateVersion: string;
    instantiatedAt: string;
    excludedFamilies: string[];
    parameterOverrides: Array<{ stableKey: string; value: string | number | boolean }>;
  };
  content: V1Content;
}

/** مدل فعالیت پیش‌فرض برای snapshotهای v1 (بدون قالب عنصر — خنثی) */
const DEFAULT_ACTIVITY_MODEL: SnapshotActivityModel = {
  workTypes: [
    "operatorManual",
    "machineAuto",
    "waiting",
    "transport",
    "inspection",
    "setupChangeover",
    "overlap",
  ],
  notesFa: "انواع زمان مطابق بخش B5 سند جامع؛ قابل توسعه در کارگاه پیکربندی.",
  elementTemplates: [],
};

export function isV1Snapshot(snapshot: unknown): snapshot is V1Snapshot {
  return (
    typeof snapshot === "object" &&
    snapshot !== null &&
    (snapshot as { snapshotVersion?: string }).snapshotVersion === "1"
  );
}

export function isV2Snapshot(snapshot: unknown): snapshot is ProjectConfigSnapshot {
  return (
    typeof snapshot === "object" &&
    snapshot !== null &&
    (snapshot as { snapshotVersion?: string }).snapshotVersion === "2"
  );
}

/** نرمال‌سازی واحد پارامتر v1 به نماد رجیستری (نمایندگی — بدون تغییر مقدار) */
const V1_UNIT_NORMALIZE: Record<string, string | undefined> = {
  "%": "percent",
  "واحد": "pcs",
  "شیفت": undefined,
  "ثانیه": "s",
  "دقیقه": "min",
  "متر": "m",
};

function normalizeV1Param(p: V1Parameter): V1Parameter & { defVersion: number } {
  const { unit, ...rest } = p;
  if (unit === undefined) return { ...rest, defVersion: 1 };
  const normalized = Object.prototype.hasOwnProperty.call(V1_UNIT_NORMALIZE, unit)
    ? V1_UNIT_NORMALIZE[unit]
    : unit;
  if (normalized === undefined) return { ...rest, defVersion: 1 };
  return { ...rest, defVersion: 1, unit: normalized };
}

/**
 * ارتقای v1→v2 — فقط نگاشت فیلد‌ها؛ فرمول‌های v1 «ارجاعی» بدون عبارت،
 * با origin:"system" و availabilityNote صادقانه ثبت می‌شوند.
 */
export function upgradeSnapshotV1ToV2(v1: V1Snapshot): ProjectConfigSnapshot {
  const content = v1.content;
  return {
    snapshotVersion: "2",
    meta: {
      templateId: v1.meta.templateId,
      templateVersion: v1.meta.templateVersion,
      instantiatedAt: v1.meta.instantiatedAt,
      upgradedFromV1: true,
      excludedFamilies: v1.meta.excludedFamilies,
      parameterOverrides: v1.meta.parameterOverrides,
    },
    families: content.families.map((f) => ({
      stableKey: f.stableKey,
      nameFa: f.nameFa,
      description: f.description,
      order: f.order,
      optionalOnCreate: f.optionalOnCreate,
      parameters: f.parameters.map((p) => normalizeV1Param(p)),
    })),
    formulas: content.formulas.map((fr) => ({
      key: fr.id,
      nameFa: fr.nameFa,
      semver: fr.semver,
      scopeLevel: fr.scopeLevel,
      status: fr.status,
      descriptionFa: fr.descriptionFa,
      expr: "",
      origin: "system" as const,
      availabilityNoteFa:
        "فرمول ارجاعی از پیکربندی فاز ۱ — عبارت اجرایی ندارد؛ در کارگاه قابل جایگزینی با نسخه اجرایی است.",
    })),
    activityModel: DEFAULT_ACTIVITY_MODEL,
    timingMethod: content.timingMethod,
    analysisChain: content.analysisChain,
    reportTemplates: content.reportTemplates,
  };
}

/** خواندن snapshot (هر نسخه/شکل) → همیشه v2 مسطح */
export function readSnapshotAsV2(raw: unknown): ProjectConfigSnapshot {
  if (raw === null || typeof raw !== "object") {
    throw new Error("ساختار snapshot پیکربندی ناشناخته است.");
  }
  const record = raw as Record<string, unknown>;
  const version = record.snapshotVersion;

  // شکل ProfileSnapshot فاز ۲: { snapshotVersion:"2", meta, content:{...v2 مسطح} } → بازکردن content
  if (version === "2" && record.content && typeof record.content === "object") {
    const content = record.content as Record<string, unknown>;
    const meta = (record.meta ?? {}) as Record<string, unknown>;
    return {
      ...(content as unknown as ProjectConfigSnapshot),
      meta: {
        templateId: (meta.templateId as string | null) ?? null,
        templateVersion: (meta.templateVersion as string | null) ?? null,
        instantiatedAt: (meta.instantiatedAt as string) ?? new Date(0).toISOString(),
        ...(meta.upgradedFromV1 !== undefined ? { upgradedFromV1: Boolean(meta.upgradedFromV1) } : {}),
        ...(Array.isArray(meta.excludedFamilies) ? { excludedFamilies: meta.excludedFamilies as string[] } : {}),
        ...(Array.isArray(meta.parameterOverrides) ? { parameterOverrides: meta.parameterOverrides as Array<{ stableKey: string; value: string | number | boolean }> } : {}),
      },
    };
  }
  if (version === "2") {
    return raw as ProjectConfigSnapshot;
  }
  if (version === "1") {
    return upgradeSnapshotV1ToV2(raw as unknown as Parameters<typeof upgradeSnapshotV1ToV2>[0]);
  }
  throw new Error("ساختار snapshot پیکربندی ناشناخته است.");
}
