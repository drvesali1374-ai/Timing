/**
 * عملیات تغییر پیکربندی (کارگاه فاز ۲) — هر دسته عملیات، یک ConfigVersion
 * جدید append-only می‌سازد (ADR-005)؛ نسخه‌های قبلی readOnly می‌مانند.
 *
 * قواعد نسخه‌بندی داخلی:
 *  - ویرایش ساختاری پارامتر → defVersion++ (مقدارهای ثبت‌شده به نسخه قدیم گره می‌خورند)
 *  - ویرایش عبارت فرمول → semver فرمول minor++ (روی نسخه کپی کاربر)
 *  - فرمول سیستمی پیش از ویرایش → کپی سفارشی با origin:custom می‌شود (FORMULA_CATALOG §۶)
 */

import { ApiError } from "@/shared/errors";
import { parse } from "@/shared/formula/engine";
import { analyzeAst, buildDependencyGraph, type SymbolTable } from "@/shared/formula/static-analysis";
import type { ExprNode } from "@/shared/formula/ast";
import type { WorkType } from "./snapshot";
import type {
  ProjectConfigSnapshot,
  SnapshotFamilyDef,
  SnapshotFormulaDef,
  SnapshotParameterDef,
} from "./snapshot";
import { buildSymbolTable, formulaResultSymbol, validateSnapshot, type SnapshotIssue } from "./validation";

// ── ورودی عملیات (zod در سرویس اعمال می‌شود) ────────────────

export type ConfigOperation =
  | { op: "addFamily"; family: Omit<SnapshotFamilyDef, "order"> & { order?: number } }
  | { op: "updateFamily"; familyKey: string; patch: Partial<Omit<SnapshotFamilyDef, "stableKey" | "parameters">> }
  | { op: "archiveFamily"; familyKey: string; archived: boolean }
  | { op: "moveFamily"; familyKey: string; direction: "up" | "down" }
  | {
      op: "addParameter";
      familyKey: string;
      parameter: Omit<SnapshotParameterDef, "defVersion"> & { defVersion?: number };
    }
  | {
      op: "updateParameter";
      /** شناسه فنی فعلی — تغییر stableKey ممنوع است (ناوردایی A5) */
      parameterKey: string;
      patch: Partial<Omit<SnapshotParameterDef, "stableKey">>;
    }
  | { op: "archiveParameter"; parameterKey: string; archived: boolean }
  | { op: "moveParameter"; parameterKey: string; direction: "up" | "down" }
  | { op: "addFormula"; formula: Omit<SnapshotFormulaDef, "semver" | "origin"> & { semver?: string; origin?: "system" | "custom" } }
  | {
      op: "updateFormula";
      formulaKey: string;
      patch: Partial<Omit<SnapshotFormulaDef, "key">>;
    }
  | { op: "deprecateFormula"; formulaKey: string; deprecated: boolean }
  | {
      op: "setActivityModel";
      workTypes?: WorkType[];
      notesFa?: string;
    }
  | { op: "addElementTemplate"; template: ProjectConfigSnapshot["activityModel"]["elementTemplates"][number] }
  | { op: "removeElementTemplate"; templateKey: string };

export interface ApplyResult {
  snapshot: ProjectConfigSnapshot;
  /** شمار تغییرات ساختاری هر جزء (برای گزارش) */
  summary: {
    familiesTouched: string[];
    parametersTouched: Array<{ key: string; defVersion: number }>;
    formulasTouched: Array<{ key: string; semver: string }>;
    operationsApplied: number;
  };
}

/** فیلدهایی که ویرایششان defVersion را بالا می‌برد (تغییر ساختاری/معنایی) */
const PARAM_STRUCTURAL_FIELDS = [
  "dataType", "required", "defaultValue", "min", "max", "precision", "rounding", "unit",
  "options", "optionsSource", "visibilityCondition", "requiredCondition", "computedFormulaKey",
] as const;

function isStructuralParamChange(patch: Partial<SnapshotParameterDef>): boolean {
  return PARAM_STRUCTURAL_FIELDS.some((f) => patch[f] !== undefined);
}

/** فیلدهای عبارت فرمول که semver فرمول را بالا می‌برند */
function isStructuralFormulaChange(patch: Partial<SnapshotFormulaDef>): boolean {
  return patch.expr !== undefined || patch.outputUnit !== undefined || patch.inputContract !== undefined;
}

function bumpSemverMinor(semver: string): string {
  const [major, minor, patch] = semver.split(".").map(Number);
  return `${major}.${minor + 1}.0`;
}

// ── اعمال دسته عملیات ───────────────────────────────────────

export function applyOperations(
  base: ProjectConfigSnapshot,
  operations: ConfigOperation[],
): ApplyResult {
  // کپی عمیق کاری — snapshot هرگز در جا تغییر نمی‌کند
  const snapshot: ProjectConfigSnapshot = structuredClone(base);
  const familiesTouched = new Set<string>();
  const parametersTouched: ApplyResult["summary"]["parametersTouched"] = [];
  const formulasTouched: ApplyResult["summary"]["formulasTouched"] = [];

  const findFamily = (key: string): SnapshotFamilyDef | undefined => snapshot.families.find((f) => f.stableKey === key);
  const findParam = (key: string): { family: SnapshotFamilyDef; param: SnapshotParameterDef } | undefined => {
    for (const family of snapshot.families) {
      const param = family.parameters.find((p) => p.stableKey === key);
      if (param) return { family, param };
    }
    return undefined;
  };
  const findFormula = (key: string): SnapshotFormulaDef | undefined => snapshot.formulas.find((f) => f.key === key);

  for (const operation of operations) {
    switch (operation.op) {
      case "addFamily": {
        if (findFamily(operation.family.stableKey)) {
          throw ApiError.conflict(`خانواده «${operation.family.stableKey}» از قبل وجود دارد.`);
        }
        const maxOrder = snapshot.families.reduce((m, f) => Math.max(m, f.order), 0);
        snapshot.families.push({
          ...operation.family,
          order: operation.family.order ?? maxOrder + 1,
        });
        familiesTouched.add(operation.family.stableKey);
        break;
      }
      case "updateFamily": {
        const family = findFamily(operation.familyKey);
        if (!family) throw ApiError.notFound(`خانواده «${operation.familyKey}» یافت نشد.`);
        Object.assign(family, operation.patch);
        familiesTouched.add(family.stableKey);
        break;
      }
      case "archiveFamily": {
        const family = findFamily(operation.familyKey);
        if (!family) throw ApiError.notFound(`خانواده «${operation.familyKey}» یافت نشد.`);
        family.archived = operation.archived;
        familiesTouched.add(family.stableKey);
        break;
      }
      case "moveFamily": {
        const sorted = [...snapshot.families].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex((f) => f.stableKey === operation.familyKey);
        if (idx === -1) throw ApiError.notFound(`خانواده «${operation.familyKey}» یافت نشد.`);
        const target = operation.direction === "up" ? idx - 1 : idx + 1;
        if (target < 0 || target >= sorted.length) break; // بدون تغییر
        [sorted[idx], sorted[target]] = [sorted[target], sorted[idx]];
        sorted.forEach((f, i) => (f.order = i + 1));
        familiesTouched.add(operation.familyKey);
        break;
      }
      case "addParameter": {
        if (findParam(operation.parameter.stableKey)) {
          throw ApiError.conflict(`پارامتر «${operation.parameter.stableKey}» از قبل وجود دارد.`);
        }
        const family = findFamily(operation.familyKey);
        if (!family) throw ApiError.notFound(`خانواده «${operation.familyKey}» برای افزودن پارامتر یافت نشد.`);
        family.parameters.push({ ...operation.parameter, defVersion: operation.parameter.defVersion ?? 1 });
        familiesTouched.add(family.stableKey);
        parametersTouched.push({ key: operation.parameter.stableKey, defVersion: 1 });
        break;
      }
      case "updateParameter": {
        const found = findParam(operation.parameterKey);
        if (!found) throw ApiError.notFound(`پارامتر «${operation.parameterKey}» یافت نشد.`);
        // ناوردایی: stableKey هرگز تغییر نمی‌کند
        const { stableKey: _ignored, ...patch } = operation.patch as Partial<SnapshotParameterDef>;
        void _ignored;
        if (isStructuralParamChange(patch)) {
          found.param.defVersion += 1;
        }
        Object.assign(found.param, patch);
        familiesTouched.add(found.family.stableKey);
        parametersTouched.push({ key: found.param.stableKey, defVersion: found.param.defVersion });
        break;
      }
      case "archiveParameter": {
        const found = findParam(operation.parameterKey);
        if (!found) throw ApiError.notFound(`پارامتر «${operation.parameterKey}» یافت نشد.`);
        found.param.archived = operation.archived;
        familiesTouched.add(found.family.stableKey);
        parametersTouched.push({ key: found.param.stableKey, defVersion: found.param.defVersion });
        break;
      }
      case "moveParameter": {
        const found = findParam(operation.parameterKey);
        if (!found) throw ApiError.notFound(`پارامتر «${operation.parameterKey}» یافت نشد.`);
        const params = found.family.parameters;
        const idx = params.indexOf(found.param);
        const target = operation.direction === "up" ? idx - 1 : idx + 1;
        if (target < 0 || target >= params.length) break;
        [params[idx], params[target]] = [params[target], params[idx]];
        familiesTouched.add(found.family.stableKey);
        break;
      }
      case "addFormula": {
        if (findFormula(operation.formula.key)) {
          throw ApiError.conflict(`فرمول «${operation.formula.key}» از قبل وجود دارد.`);
        }
        const formula: SnapshotFormulaDef = {
          ...operation.formula,
          semver: operation.formula.semver ?? "1.0.0",
          origin: operation.formula.origin ?? "custom",
        };
        // parse عبارت و ذخیره AST
        if (formula.expr) {
          const parsed = parse(formula.expr);
          if (!parsed.ok) {
            throw ApiError.badRequest(`عبارت فرمول «${formula.key}» نامعتبر است: ${parsed.error?.messageFa}`);
          }
          formula.ast = parsed.serialized;
        }
        snapshot.formulas.push(formula);
        formulasTouched.push({ key: formula.key, semver: formula.semver });
        break;
      }
      case "updateFormula": {
        const formula = findFormula(operation.formulaKey);
        if (!formula) throw ApiError.notFound(`فرمول «${operation.formulaKey}» یافت نشد.`);
        const { key: _k, ...patch } = operation.patch as Partial<SnapshotFormulaDef>;
        void _k;

        // فرمول سیستمی با تغییر عبارت → کپی سفارشی نمی‌شود اینجا؛ سیاست: فرمول سیستمی
        // فقط «غیرفعال‌شدنی» است؛ برای ویرایش، کاربر فرمول سفارشی می‌سازد (FORMULA_CATALOG §۶).
        if (formula.origin === "system" && isStructuralFormulaChange(patch)) {
          throw ApiError.forbidden(
            `فرمول سیستمی «${formula.key}» قابل ویرایش مستقیم نیست — فرمول سفارشی جدید بسازید یا نسخه کپی بگیرید.`,
          );
        }
        if (isStructuralFormulaChange(patch)) {
          formula.semver = bumpSemverMinor(formula.semver);
        }
        if (patch.expr !== undefined && patch.expr !== "") {
          const parsed = parse(patch.expr);
          if (!parsed.ok) {
            throw ApiError.badRequest(`عبارت فرمول نامعتبر است: ${parsed.error?.messageFa}`);
          }
          patch.ast = parsed.serialized;
        }
        Object.assign(formula, patch);
        formulasTouched.push({ key: formula.key, semver: formula.semver });
        break;
      }
      case "deprecateFormula": {
        const formula = findFormula(operation.formulaKey);
        if (!formula) throw ApiError.notFound(`فرمول «${operation.formulaKey}» یافت نشد.`);
        formula.status = operation.deprecated ? "deprecated" : "active";
        formulasTouched.push({ key: formula.key, semver: formula.semver });
        break;
      }
      case "setActivityModel": {
        if (operation.workTypes !== undefined) {
          if (operation.workTypes.length === 0) {
            throw ApiError.badRequest("فهرست انواع کار نمی‌تواند خالی باشد.");
          }
          snapshot.activityModel.workTypes = operation.workTypes;
        }
        if (operation.notesFa !== undefined) snapshot.activityModel.notesFa = operation.notesFa;
        break;
      }
      case "addElementTemplate": {
        if (snapshot.activityModel.elementTemplates.some((t) => t.stableKey === operation.template.stableKey)) {
          throw ApiError.conflict(`قالب عنصر «${operation.template.stableKey}» تکراری است.`);
        }
        snapshot.activityModel.elementTemplates.push(operation.template);
        break;
      }
      case "removeElementTemplate": {
        const idx = snapshot.activityModel.elementTemplates.findIndex((t) => t.stableKey === operation.templateKey);
        if (idx === -1) throw ApiError.notFound(`قالب عنصر «${operation.templateKey}» یافت نشد.`);
        snapshot.activityModel.elementTemplates.splice(idx, 1);
        break;
      }
      default:
        throw ApiError.badRequest("نوع عملیات ناشناخته است.");
    }
  }

  // اعتبارسنجی کامل snapshot پس از اعمال
  const issues: SnapshotIssue[] = validateSnapshot(snapshot);
  if (issues.length > 0) {
    throw ApiError.badRequest(
      `پس از اعمال تغییرات، پیکربندی نامعتبر است — ${issues.length} مورد:\n` +
        issues.slice(0, 12).map((i) => `• ${i.path}: ${i.messageFa}`).join("\n"),
    );
  }

  return {
    snapshot,
    summary: {
      familiesTouched: [...familiesTouched],
      parametersTouched,
      formulasTouched,
      operationsApplied: operations.length,
    },
  };
}

// ── تحلیل چرخه فرمول‌های snapshot ────────────────────────────

/** بررسی چرخه وابستگی فرمول‌های یک snapshot — پیش از ذخیره */
export function checkFormulaCycles(snapshot: ProjectConfigSnapshot): string[][] {
  const nodes = snapshot.formulas
    .filter((f) => f.expr)
    .map((f) => {
      const parsed = parse(f.expr);
      return { key: f.key, resultSymbol: formulaResultSymbol(f.key), ast: parsed.ok ? (parsed.ast as ExprNode) : null };
    });
  return buildDependencyGraph(nodes).cycles;
}

/** اعتبارسنجی عبارت فرمول در برابر نمادهای snapshot (برای UI فرمول‌ساز) */
/** اعتبارسنجی عبارت در برابر جدول نماد مستقیم (آزمون فرمول با قرارداد ورودی خودش) */
export function validateFormulaExprWithSymbols(expr: string, symbols: SymbolTable) {
  const parsed = parse(expr);
  if (!parsed.ok || !parsed.ast) {
    return {
      parseOk: false,
      errors: [{ code: "parse", messageFa: parsed.error?.messageFa ?? "عبارت قابل تجزیه نیست." }],
      warnings: [] as Array<{ messageFa: string }>,
      refs: { parameters: [], formulaResults: [], unknown: [] },
      inferredType: "any",
    };
  }
  const analysis = analyzeAst(parsed.ast, symbols);
  return {
    parseOk: true,
    errors: analysis.errors.map((e) => ({ code: e.code, messageFa: e.messageFa })),
    warnings: analysis.warnings,
    refs: analysis.refs,
    inferredType: analysis.inferredType,
  };
}

export function validateFormulaExpr(
  expr: string,
  snapshot: ProjectConfigSnapshot,
  options?: { excludeFormulaKey?: string },
): {
  parseOk: boolean;
  errors: Array<{ code: string; messageFa: string }>;
  warnings: Array<{ messageFa: string }>;
  refs: { parameters: string[]; formulaResults: string[]; unknown: string[] };
  inferredType: string;
} {
  const symbols = buildSymbolTable(snapshot, options);
  const parsed = parse(expr);
  if (!parsed.ok || !parsed.ast) {
    return {
      parseOk: false,
      errors: [{ code: "parse", messageFa: parsed.error?.messageFa ?? "عبارت قابل تجزیه نیست." }],
      warnings: [],
      refs: { parameters: [], formulaResults: [], unknown: [] },
      inferredType: "any",
    };
  }
  const analysis = analyzeAst(parsed.ast, symbols);
  return {
    parseOk: true,
    errors: analysis.errors.map((e) => ({ code: e.code, messageFa: e.messageFa })),
    warnings: analysis.warnings,
    refs: analysis.refs,
    inferredType: analysis.inferredType,
  };
}
