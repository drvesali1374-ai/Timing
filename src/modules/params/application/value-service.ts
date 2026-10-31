/**
 * لایه Application ماژول پارامترها — فاز ۲:
 *  - ثبت/خواندن مقدار پارامتر در دامنه project (با defVersion pinning — B2)
 *  - ارزیابی فرمول در دامنه project با مقادیر واقعی + ذخیره CalculationResult
 *    (append-only — A7: تغییر فرمول نتیجه قبلی را بی‌سروصدا جایگزین نمی‌کند)
 *
 * فرمول‌های سطح عنصر/چرخه نیازمند مشاهدات فاز ۴+ هستند؛ ارزیابی آنها با
 * availabilityNote صادقانه رد می‌شود (بدون داده نمایشی جعلی).
 */

import { uuidv7 } from "@/shared/ids";
import { ApiError } from "@/shared/errors";
import { getLogger } from "@/shared/logger";
import { parse } from "@/shared/formula/engine";
import { evaluate as engineEvaluate } from "@/shared/formula/engine";
import type { EvalInput } from "@/shared/formula/evaluator";
import { getCurrentConfig } from "@/modules/config/application/config-service";
import { formulaResultSymbol } from "@/shared/contracts/snapshot";
import type { ProjectConfigSnapshot, SnapshotFormulaDef, SnapshotParameterDef } from "@/shared/contracts/snapshot";
import { AUDIT_ACTIONS, recordAudit } from "@/modules/audit/application/audit-service";
import {
  defaultValueFor,
  toFormulaInput,
  validateValueAgainstDef,
  type StoredParamValue,
} from "../domain/value";
import {
  insertCalculationResultRow,
  latestCalculationResultRows,
  listParamValueRows,
  upsertParamValueRow,
} from "../infrastructure/value-repo";

const log = getLogger("params");

const PROJECT_SCOPE = { scopeType: "project", scopeId: "" };

// ── جستجوی تعریف در snapshot ────────────────────────────────

function findParam(snapshot: ProjectConfigSnapshot, stableKey: string): { param: SnapshotParameterDef; familyName: string } | null {
  for (const family of snapshot.families) {
    if (family.archived) continue;
    const param = family.parameters.find((p) => p.stableKey === stableKey);
    if (param && !param.archived) return { param, familyName: family.nameFa };
  }
  return null;
}

// ── ثبت مقدار ───────────────────────────────────────────────

export interface SaveValueInput {
  projectId: string;
  userId: string;
  stableKey: string;
  value: unknown;
}

export interface ParamValueDto {
  stableKey: string;
  nameFa: string;
  familyName: string;
  dataType: string;
  defVersion: number;
  value: StoredParamValue;
  required: boolean;
  /** نسخه تعریف فعلی snapshot — اگر با defVersion مقدار فرق کند یعنی تعریف عوض شده */
  currentDefVersion: number;
  unit?: string;
  options?: Array<{ value: string; labelFa: string }>;
  visibilityCondition?: string;
  requiredCondition?: string;
  suggestionNoteFa?: string;
  updatedAt: string | null;
}

export async function saveParamValue(input: SaveValueInput): Promise<ParamValueDto> {
  const { projectId, userId, stableKey, value } = input;
  const { snapshot } = await getCurrentConfig(projectId);
  const found = findParam(snapshot, stableKey);
  if (!found) throw ApiError.notFound(`پارامتر «${stableKey}» در پیکربندی جاری یافت نشد.`);
  if (found.param.dataType === "computed") {
    throw ApiError.badRequest("پارامتر محاسباتی مقدار دستی نمی‌پذیرد.");
  }

  const validation = validateValueAgainstDef(found.param, value);
  if (!validation.ok) {
    throw ApiError.badRequest(validation.messageFa);
  }

  // defVersion لحظه ثبت — مقدار به نسخه تعریف گره می‌خورد (بدون تبدیل پنهانی)
  await upsertParamValueRow({
    id: uuidv7(),
    projectId,
    stableKey,
    defVersion: found.param.defVersion,
    ...PROJECT_SCOPE,
    valueJson: JSON.stringify(validation.stored),
    recordedBy: userId,
  });
  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.parameterValueSaved,
    entityType: "ParameterValue",
    entityId: stableKey,
    projectId,
    after: { value: validation.stored, defVersion: found.param.defVersion },
  });
  log.info("param value saved", { projectId, stableKey, defVersion: found.param.defVersion });

  const values = await listProjectValues(projectId, userId);
  return values.find((v) => v.stableKey === stableKey) ?? listDto(found.param, found.familyName, validation.stored, null);
}

function listDto(
  param: SnapshotParameterDef,
  familyName: string,
  stored: StoredParamValue,
  updatedAt: Date | null,
): ParamValueDto {
  return {
    stableKey: param.stableKey,
    nameFa: param.nameFa,
    familyName,
    dataType: param.dataType,
    defVersion: param.defVersion, // در listDto فراخواننده نسخه گره‌خورده را جایگزین می‌کند
    value: stored,
    required: !!param.required,
    currentDefVersion: param.defVersion,
    ...(param.unit ? { unit: param.unit } : {}),
    ...(param.options ? { options: param.options } : {}),
    ...(param.visibilityCondition ? { visibilityCondition: param.visibilityCondition } : {}),
    ...(param.requiredCondition ? { requiredCondition: param.requiredCondition } : {}),
    ...(param.suggestionNoteFa ? { suggestionNoteFa: param.suggestionNoteFa } : {}),
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
  };
}

/** فهرست مقدارهای دامنه project با تعاریف جاری — منبع فرم‌ساز */
export async function listProjectValues(projectId: string, _userId: string): Promise<ParamValueDto[]> {
  const { snapshot } = await getCurrentConfig(projectId);
  const rows = await listParamValueRows(projectId, PROJECT_SCOPE.scopeType, PROJECT_SCOPE.scopeId);
  const byKey = new Map(rows.map((r) => [r.stableKey, r]));

  const out: ParamValueDto[] = [];
  for (const family of [...snapshot.families].sort((a, b) => a.order - b.order)) {
    if (family.archived) continue;
    for (const param of family.parameters) {
      if (param.archived) continue;
      if (param.dataType === "computed") continue; // فرم‌ساز مقدار دستی نمی‌گیرد
      const row = byKey.get(param.stableKey);
      let stored: StoredParamValue;
      let pinnedDefVersion = param.defVersion;
      if (row) {
        try {
          stored = JSON.parse(row.valueJson) as StoredParamValue;
          pinnedDefVersion = row.defVersion;
        } catch {
          stored = { value: null };
        }
      } else {
        stored = defaultValueFor(param);
      }
      const dto = listDto(param, family.nameFa, stored, row?.updatedAt ?? null);
      dto.defVersion = pinnedDefVersion;
      out.push(dto);
    }
  }
  return out;
}

// ── ارزیابی فرمول در دامنه project ──────────────────────────

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

export interface EvaluateInput {
  projectId: string;
  userId: string;
  formulaKey: string;
}

/** ارزیابی + ذخیره نتیجه (append-only) — نتیجه قبلی حفظ می‌شود */
export async function evaluateFormulaAtProjectScope(input: EvaluateInput): Promise<FormulaResultDto> {
  const { projectId, userId, formulaKey } = input;
  const config = await getCurrentConfig(projectId);
  const formula: SnapshotFormulaDef | undefined = config.snapshot.formulas.find((f) => f.key === formulaKey);
  if (!formula) throw ApiError.notFound(`فرمول «${formulaKey}» در پیکربندی جاری یافت نشد.`);
  if (formula.status === "deprecated") {
    throw ApiError.badRequest(`فرمول «${formulaKey}» منسوخ شده است.`);
  }
  if (!formula.expr) {
    throw ApiError.badRequest(
      `فرمول «${formulaKey}» عبارت اجرایی ندارد${formula.availabilityNoteFa ? ` — ${formula.availabilityNoteFa}` : ""}.`,
    );
  }
  if (formula.scopeLevel !== "project") {
    throw ApiError.badRequest(
      `این فرمول در سطح «${formula.scopeLevel}» تعریف شده است؛ داده آن سطح در فاز ۴/۵ در دسترس قرار می‌گیرد (ارزیابی در دامنه پروژه ممکن نیست).`,
    );
  }

  // جمع‌آوری ورودی‌ها از مقادیر واقعی ثبت‌شده
  const values = await listParamValueRows(projectId, PROJECT_SCOPE.scopeType, PROJECT_SCOPE.scopeId);
  const valueByKey = new Map(values.map((r) => [r.stableKey, r]));
  const inputs: Record<string, EvalInput> = {};
  const formulaDefaults: Record<string, EvalInput> = {};

  // پارامترها
  for (const family of config.snapshot.families) {
    if (family.archived) continue;
    for (const param of family.parameters) {
      if (param.archived) continue;
      const row = valueByKey.get(param.stableKey);
      let stored: StoredParamValue;
      if (row) {
        try {
          stored = JSON.parse(row.valueJson) as StoredParamValue;
        } catch {
          stored = { value: null };
        }
      } else {
        stored = defaultValueFor(param);
      }
      inputs[param.stableKey] = toFormulaInput(stored) as EvalInput;
    }
  }

  // نتایج فرمول‌های دیگر (سطح project) — وابستگی زنجیره‌ای با ارزیابی درخواستی
  const priorResults = await latestCalculationResultRows(projectId, 100);
  for (const row of priorResults) {
    if (row.status === "valid" && row.scopeType === "project") {
      try {
        const parsed = JSON.parse(row.valueJson ?? "null") as StoredParamValue;
        formulaDefaults[formulaResultSymbol(row.formulaKey)] = toFormulaInput(parsed) as EvalInput;
      } catch {
        // نادیده — نتیجه خراب ورودی نمی‌شود
      }
    }
  }
  const mergedInputs = { ...formulaDefaults, ...inputs };

  // ارزیابی قطعی
  const parsedExpr = parse(formula.expr);
  if (!parsedExpr.ok || !parsedExpr.ast) {
    throw ApiError.badRequest(`عبارت فرمول «${formulaKey}» قابل تجزیه نیست: ${parsedExpr.error?.messageFa ?? ""}`);
  }
  const outcome = engineEvaluate(parsedExpr.ast, mergedInputs);

  // ذخیره append-only
  const resultId = uuidv7();
  await insertCalculationResultRow({
    id: resultId,
    projectId,
    formulaKey,
    formulaSemver: formula.semver,
    configVersionId: config.versionId ?? "",
    ...PROJECT_SCOPE,
    valueJson: outcome.status === "invalid" ? null : JSON.stringify({ value: outcome.value, ...(outcome.unit !== undefined ? { unit: outcome.unit } : {}) }),
    status: outcome.status,
    errorsJson: JSON.stringify(outcome.errors),
    traceJson: JSON.stringify(outcome.trace),
    inputRefsJson: JSON.stringify(outcome.inputRefs),
    computedBy: userId,
  });
  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.formulaEvaluated,
    entityType: "CalculationResult",
    entityId: resultId,
    projectId,
    after: { formulaKey, formulaSemver: formula.semver, status: outcome.status, configSemver: config.semver },
  });
  log.info("formula evaluated", { projectId, formulaKey, status: outcome.status });

  return {
    id: resultId,
    formulaKey,
    formulaNameFa: formula.nameFa,
    formulaSemver: formula.semver,
    scopeLevel: formula.scopeLevel,
    status: outcome.status,
    value: outcome.value,
    ...(outcome.unit !== undefined ? { unit: outcome.unit } : {}),
    errors: outcome.errors.map((e) => ({ code: e.code, messageFa: e.messageFa })),
    trace: outcome.trace,
    inputRefs: outcome.inputRefs,
    configVersionId: config.versionId ?? "",
    computedAt: new Date().toISOString(),
  };
}

/** آخرین نتیجه هر فرمول (برای بازیابی پس از بستن/بازکردن پروژه) */
export async function listFormulaResults(projectId: string): Promise<FormulaResultDto[]> {
  const config = await getCurrentConfig(projectId);
  const formulaByKey = new Map(config.snapshot.formulas.map((f) => [f.key, f]));
  const rows = await latestCalculationResultRows(projectId, 100);
  return rows.map((row) => {
    let stored: StoredParamValue = { value: null };
    if (row.valueJson) {
      try {
        stored = JSON.parse(row.valueJson) as StoredParamValue;
      } catch {
        // نادیده
      }
    }
    let errors: Array<{ code: string; messageFa: string }> = [];
    try {
      errors = JSON.parse(row.errorsJson ?? "[]");
    } catch {
      // نادیده
    }
    let trace: FormulaResultDto["trace"] = [];
    try {
      trace = JSON.parse(row.traceJson ?? "[]");
    } catch {
      // نادیده
    }
    let inputRefs: string[] = [];
    try {
      inputRefs = JSON.parse(row.inputRefsJson ?? "[]");
    } catch {
      // نادیده
    }
    const formula = formulaByKey.get(row.formulaKey);
    return {
      id: row.id,
      formulaKey: row.formulaKey,
      formulaNameFa: formula?.nameFa ?? row.formulaKey,
      formulaSemver: row.formulaSemver,
      scopeLevel: formula?.scopeLevel ?? "project",
      status: row.status as FormulaResultDto["status"],
      value: stored.value,
      ...(stored.unit !== undefined ? { unit: stored.unit } : {}),
      errors,
      trace,
      inputRefs,
      configVersionId: row.configVersionId,
      computedAt: row.computedAt.toISOString(),
    };
  });
}

/** شمار نتایج معتبر (برای readiness — زمان استاندارد در فاز ۵ معنی‌دار می‌شود) */
export async function countValidResults(projectId: string): Promise<number> {
  const rows = await latestCalculationResultRows(projectId, 500);
  return rows.filter((r) => r.status === "valid").length;
}
