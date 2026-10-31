/**
 * اعتبارسنجی دامنه snapshot v2 — zod + قواعد ناوردایی.
 * منبع واحد اعتبارسنجی برای عملیات کارگاه و import.
 */

import { z } from "zod";
import { ApiError } from "@/shared/errors";
import { UNITS } from "@/shared/formula/units";
import { FUNCTION_SIGNATURES } from "@/shared/formula/functions";
import type { SymbolTable } from "@/shared/formula/static-analysis";
import { parseFormula } from "@/shared/formula/parser";
import { walkAll } from "@/shared/formula/ast";
import { formulaResultSymbol } from "@/shared/contracts/snapshot";
export { formulaResultSymbol };
import type { ProjectConfigSnapshot, SnapshotFamilyDef, SnapshotFormulaDef, SnapshotParameterDef } from "./snapshot";

// ── شِمای zod ────────────────────────────────────────────────

export const STABLE_KEY_RE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/;
export const FORMULA_KEY_RE = /^(TS|ST|LB|MM)-\d{3}$|^f\.[a-z][a-zA-Z0-9]*$/;
export const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export const DATA_TYPES = [
  "shortText", "longText", "integer", "decimal", "percent", "ratio", "duration",
  "dateTime", "boolean", "singleSelect", "multiSelect", "quantityWithUnit", "entityRef", "computed",
] as const;

export const ANALYSIS_ROLES = ["input", "grouping", "filter", "variable", "outputIndex", "informational"] as const;
export const DISPLAY_CONTEXTS = ["form", "table", "chart", "report"] as const;
export const SCOPE_LEVELS = ["observation", "element", "cycle", "cycleSet", "group", "project", "balanceScenario"] as const;
export const FORMULA_STATUSES = ["draft", "active", "deprecated"] as const;
export const WORK_TYPES = [
  "operatorManual", "machineAuto", "waiting", "transport", "inspection", "setupChangeover", "overlap",
] as const;
export const VA_CLASSIFICATIONS = ["valueAdded", "nonValueAdded", "essentialNonVA"] as const;
export const SOURCE_OF_TIME = ["measured", "estimated", "referenced"] as const;

const paramSchema = z.object({
  stableKey: z.string().regex(STABLE_KEY_RE, "شناسه فنی باید با حرف کوچک لاتین شروع شود و بخش‌ها با نقطه جدا شوند (مثل study.shift یا stats.targetPrecision)"),
  nameFa: z.string().min(1, "نام فارسی الزامی است").max(120),
  description: z.string().max(2000).optional(),
  helpFa: z.string().max(2000).optional(),
  code: z.string().max(40).optional(),
  dataType: z.enum(DATA_TYPES),
  analysisRole: z.enum(ANALYSIS_ROLES),
  required: z.boolean().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  precision: z.number().int().min(0).max(10).optional(),
  rounding: z.enum(["floor", "ceil", "round", "none"]).optional(),
  unit: z.string().optional(),
  options: z.array(z.object({ value: z.string().min(1), labelFa: z.string().min(1) })).optional(),
  optionsSource: z
    .object({ type: z.literal("manual"), noteFa: z.string().optional() })
    .or(z.object({ type: z.literal("familyRef"), familyKey: z.string() }))
    .optional(),
  visibilityCondition: z.string().max(2048).optional(),
  requiredCondition: z.string().max(2048).optional(),
  computedFormulaKey: z.string().optional(),
  displayContexts: z.array(z.enum(DISPLAY_CONTEXTS)).min(1, "حداقل یک محل نمایش لازم است"),
  configurableOnCreate: z.boolean().optional(),
  suggestionNoteFa: z.string().max(500).optional(),
  customAttrs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  defVersion: z.number().int().min(1),
  archived: z.boolean().optional(),
});

const familySchema = z.object({
  stableKey: z.string().regex(STABLE_KEY_RE),
  nameFa: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  code: z.string().max(40).optional(),
  order: z.number().int().min(0),
  optionalOnCreate: z.boolean().optional(),
  archived: z.boolean().optional(),
  parameters: z.array(paramSchema),
});

const formulaSchema = z.object({
  key: z.string().regex(FORMULA_KEY_RE, "کلید فرمول مثل TS-011 (سیستمی) یا f.zamanKol (سفارشی — بدون خط تیره)"),
  nameFa: z.string().min(1).max(120),
  semver: z.string().regex(SEMVER_RE),
  scopeLevel: z.enum(SCOPE_LEVELS),
  status: z.enum(FORMULA_STATUSES),
  descriptionFa: z.string().min(1).max(2000),
  expr: z.string().max(2048),
  ast: z.any().optional(),
  outputUnit: z.string().optional(),
  origin: z.enum(["system", "custom"]),
  inputContract: z.record(z.string(), z.object({
    type: z.enum(["number", "string", "boolean", "numberArray"]),
    unit: z.string().optional(),
    noteFa: z.string().optional(),
  })).optional(),
  sourceRef: z.object({ type: z.string(), name: z.string(), version: z.string().optional(), url: z.string().optional() }).optional(),
  assumptionsFa: z.array(z.string()).optional(),
  availabilityNoteFa: z.string().max(1000).optional(),
});

export const snapshotSchema = z.object({
  snapshotVersion: z.literal("2"),
  meta: z.object({
    templateId: z.string().nullable(),
    templateVersion: z.string().nullable(),
    instantiatedAt: z.string(),
    upgradedFromV1: z.boolean().optional(),
    excludedFamilies: z.array(z.string()).optional(),
    parameterOverrides: z.array(z.object({ stableKey: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) })).optional(),
  }),
  families: z.array(familySchema),
  formulas: z.array(formulaSchema),
  activityModel: z.object({
    workTypes: z.array(z.enum(WORK_TYPES)).min(1),
    notesFa: z.string().optional(),
    elementTemplates: z.array(z.object({
      stableKey: z.string().regex(STABLE_KEY_RE),
      nameFa: z.string().min(1),
      workType: z.enum(WORK_TYPES),
      description: z.string().optional(),
      vaClassification: z.enum(VA_CLASSIFICATIONS).optional(),
    })),
  }),
  timingMethod: z.object({ default: z.enum(["continuous", "snapback", "laps"]), notesFa: z.string().optional() }).optional(),
  analysisChain: z.array(z.object({
    step: z.number().int().min(1),
    nameFa: z.string().min(1),
    descriptionFa: z.string().min(1),
    formulaRefs: z.array(z.string()).optional(),
  })),
  reportTemplates: z.array(z.object({ id: z.string(), nameFa: z.string(), descriptionFa: z.string().optional() })),
});

// ── قواعد ناوردایی معنایی (فراتر از شِما) ────────────────────

export interface SnapshotIssue {
  path: string;
  messageFa: string;
}

/** اعتبارسنجی کامل snapshot — شِما + ناوردایی‌های دامنه */
export function validateSnapshot(snapshot: ProjectConfigSnapshot): SnapshotIssue[] {
  const issues: SnapshotIssue[] = [];

  // شِما
  const parsed = snapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({ path: issue.path.join("."), messageFa: issue.message });
    }
    return issues; // اگر شِما خراب است، ناوردایی‌ها معنا ندارند
  }

  // یکتایی stableKeyها در کل snapshot
  const seenParamKeys = new Set<string>();
  const familyKeys = new Set<string>();
  for (const family of snapshot.families) {
    if (familyKeys.has(family.stableKey)) {
      issues.push({ path: `families.${family.stableKey}`, messageFa: "کلید خانواده تکراری است." });
    }
    familyKeys.add(family.stableKey);
    for (const param of family.parameters) {
      if (seenParamKeys.has(param.stableKey)) {
        issues.push({ path: `param.${param.stableKey}`, messageFa: "شناسه فنی پارامتر در کل پیکربندی باید یکتا باشد." });
      }
      seenParamKeys.add(param.stableKey);

      // انواع عددی: min ≤ max
      if (param.min !== undefined && param.max !== undefined && param.min > param.max) {
        issues.push({ path: `param.${param.stableKey}`, messageFa: "حداقل نباید از حداکثر بیشتر باشد." });
      }
      // انتخاب‌ها: گزینه‌ها لازم‌اند
      if ((param.dataType === "singleSelect" || param.dataType === "multiSelect") && (!param.options || param.options.length === 0)) {
        issues.push({ path: `param.${param.stableKey}`, messageFa: "نوع انتخابی بدون فهرست گزینه‌ها تعریف شده است." });
      }
      // واحد معتبر
      if (param.unit !== undefined && param.unit !== "" && !(param.unit in UNITS)) {
        issues.push({ path: `param.${param.stableKey}`, messageFa: `واحد «${param.unit}» در رجیستری واحدها ثبت نشده است.` });
      }
      // computed باید به فرمول ارجاع دهد
      if (param.dataType === "computed" && !param.computedFormulaKey) {
        issues.push({ path: `param.${param.stableKey}`, messageFa: "پارامتر محاسباتی باید به یک فرمول ارجاع دهد." });
      }
      // percent/ratio/duration پیشنهاد واحد
      if (param.dataType === "percent" && param.unit && param.unit !== "percent") {
        issues.push({ path: `param.${param.stableKey}`, messageFa: "واحد پارامتر درصدی باید «percent» باشد." });
      }
    }
  }

  // فرمول‌ها
  const formulaKeys = new Set<string>();
  for (const formula of snapshot.formulas) {
    if (formulaKeys.has(formula.key)) {
      issues.push({ path: `formula.${formula.key}`, messageFa: "کلید فرمول تکراری است." });
    }
    formulaKeys.add(formula.key);

    // قرارداد ورودی: کلیدهای معتبر
    if (formula.inputContract) {
      for (const [name, spec] of Object.entries(formula.inputContract)) {
        if (name.includes(" ")) {
          issues.push({ path: `formula.${formula.key}.inputContract.${name}`, messageFa: "نام ورودی نباید فاصله داشته باشد." });
        }
        if (spec.unit !== undefined && spec.unit !== "" && !(spec.unit in UNITS)) {
          issues.push({ path: `formula.${formula.key}.inputContract.${name}`, messageFa: `واحد ورودی «${spec.unit}» ناشناخته است.` });
        }
      }
    }
    // ارجاع زنجیره تحلیل
  }
  for (const step of snapshot.analysisChain) {
    for (const ref of step.formulaRefs ?? []) {
      if (!formulaKeys.has(ref)) {
        issues.push({ path: `analysisChain.step${step.step}`, messageFa: `ارجاع فرمول «${ref}» در فهرست فرمول‌ها وجود ندارد.` });
      }
    }
  }
  // پارامترهای computed → فرمول موجود
  for (const family of snapshot.families) {
    for (const param of family.parameters) {
      if (param.computedFormulaKey && !formulaKeys.has(param.computedFormulaKey)) {
        issues.push({ path: `param.${param.stableKey}`, messageFa: `فرمول محاسباتی «${param.computedFormulaKey}» وجود ندارد.` });
      }
    }
  }

  return issues;
}

/** پرتاب خطای API با فهرست مشکلات (برای import/apply) */
export function assertSnapshotValid(snapshot: ProjectConfigSnapshot, contextFa: string): void {
  const issues = validateSnapshot(snapshot);
  if (issues.length > 0) {
    throw ApiError.badRequest(`${contextFa} — ${issues.length} مورد نامعتبر:\n` + issues.slice(0, 12).map((i) => `• ${i.path}: ${i.messageFa}`).join("\n"));
  }
}

// ── جدول نمادها برای تحلیل ایستای فرمول ─────────────────────

/** نوع تقریبی پارامتر بر اساس dataType */
export function paramSymbolType(dataType: SnapshotParameterDef["dataType"]): "number" | "string" | "boolean" | "any" {
  switch (dataType) {
    case "integer":
    case "decimal":
    case "percent":
    case "ratio":
    case "duration":
    case "quantityWithUnit":
      return "number";
    case "shortText":
    case "longText":
    case "dateTime":
    case "singleSelect":
    case "entityRef":
      return "string";
    case "boolean":
      return "boolean";
    // multiSelect آرایه رشته است؛ در تحلیل تقریبی any در نظر گرفته می‌شود
    default:
      return "any";
  }
}

/**
 * ساخت جدول نمادها از snapshot — پارامترها با نوع/واحد + نتایج فرمول‌های دیگر.
 * نام نتیجه هر فرمول: «<کلید>.result».
 */
export function buildSymbolTable(
  snapshot: ProjectConfigSnapshot,
  options?: { excludeFormulaKey?: string },
): SymbolTable {
  const symbols: SymbolTable = {};
  for (const family of snapshot.families) {
    if (family.archived) continue;
    for (const param of family.parameters) {
      if (param.archived) continue;
      const type = paramSymbolType(param.dataType);
      symbols[param.stableKey] = {
        type: type === "any" ? "any" : type,
        ...(param.unit ? { unit: param.unit } : {}),
        source: "parameter",
      };
    }
  }
  for (const formula of snapshot.formulas) {
    if (formula.status === "deprecated") continue;
    if (options?.excludeFormulaKey === formula.key) continue;
    symbols[formulaResultSymbol(formula.key)] = {
      type: formula.outputUnit !== undefined || inferFormulaNumeric(formula) ? "number" : "any",
      ...(formula.outputUnit ? { unit: formula.outputUnit } : {}),
      source: "formulaResult",
    };
  }
  return symbols;
}

function inferFormulaNumeric(formula: SnapshotFormulaDef): boolean {
  if (!formula.expr) return false;
  const parsed = parseFormula(formula.expr);
  if (!parsed.ok || !parsed.ast) return false;
  let numeric = false;
  walkAll(parsed.ast, (node) => {
    if (node.kind === "num") numeric = true;
    if (node.kind === "call") {
      const sig = FUNCTION_SIGNATURES[node.callee];
      if (sig && (sig.returnType === "number" || sig.returnType === "numberArray")) numeric = true;
    }
  });
  return numeric;
}
